import {
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type {
  TeacherCommandEvent,
  TeacherDrawRequest,
  TeacherSessionCredentials,
} from "@/types/teacher";

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const SESSION_TTL_SECONDS = Math.floor(SESSION_TTL_MS / 1000);
const REPLAY_LIMIT = 256;
const REDIS_PREFIX = "convoai:teacher";

interface TeacherSessionRecord {
  id: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  nextEventId: number;
  replay: TeacherCommandEvent[];
}

interface RateLimitRecord {
  count: number;
  expiresAt: number;
}

interface TeacherBrokerGlobal {
  __teacherSessionRegistry?: Map<string, TeacherSessionRecord>;
  __activeTeacherSessionId?: string;
  __teacherRateLimits?: Map<string, RateLimitRecord>;
}

interface RedisConfig {
  url: string;
  token: string;
}

const brokerGlobal = globalThis as typeof globalThis & TeacherBrokerGlobal;
const sessions =
  brokerGlobal.__teacherSessionRegistry ?? new Map<string, TeacherSessionRecord>();
const rateLimits =
  brokerGlobal.__teacherRateLimits ?? new Map<string, RateLimitRecord>();
brokerGlobal.__teacherSessionRegistry = sessions;
brokerGlobal.__teacherRateLimits = rateLimits;

function getRedisConfig(): RedisConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function redisCommand<T>(
  config: RedisConfig,
  command: Array<string | number>,
): Promise<T> {
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as {
    result?: T;
    error?: string;
  } | null;
  if (!response.ok || !payload || payload.error) {
    throw new Error("Shared teacher session storage is unavailable.");
  }
  return payload.result as T;
}

function sessionKey(sessionId: string): string {
  return `${REDIS_PREFIX}:session:${sessionId}`;
}

function sequenceKey(sessionId: string): string {
  return `${REDIS_PREFIX}:sequence:${sessionId}`;
}

function eventsKey(sessionId: string): string {
  return `${REDIS_PREFIX}:events:${sessionId}`;
}

function activeSessionKey(): string {
  return `${REDIS_PREFIX}:active`;
}

function secureToken(): string {
  return randomBytes(32).toString("base64url");
}

function tokensMatch(expected: string, received: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return (
    expectedBytes.length === receivedBytes.length &&
    timingSafeEqual(expectedBytes, receivedBytes)
  );
}

function purgeExpiredSessions(now = Date.now()): void {
  for (const [sessionId, record] of sessions) {
    if (record.expiresAt <= now) sessions.delete(sessionId);
  }
  for (const [bucket, record] of rateLimits) {
    if (record.expiresAt <= now) rateLimits.delete(bucket);
  }
}

async function getStoredSession(
  sessionId: string,
): Promise<TeacherSessionRecord | null> {
  const redis = getRedisConfig();
  if (!redis) {
    purgeExpiredSessions();
    return sessions.get(sessionId) ?? null;
  }
  const raw = await redisCommand<string | null>(redis, [
    "GET",
    sessionKey(sessionId),
  ]);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TeacherSessionRecord;
  } catch {
    return null;
  }
}

export async function createTeacherSession(): Promise<TeacherSessionCredentials> {
  purgeExpiredSessions();
  const now = Date.now();
  const record: TeacherSessionRecord = {
    id: randomUUID(),
    token: secureToken(),
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    nextEventId: 1,
    replay: [],
  };
  const redis = getRedisConfig();
  if (!redis && process.env.NODE_ENV === "production") {
    throw new Error(
      "Teacher Mode requires shared Redis storage in production.",
    );
  }
  if (redis) {
    await Promise.all([
      redisCommand(redis, [
        "SET",
        sessionKey(record.id),
        JSON.stringify(record),
        "EX",
        SESSION_TTL_SECONDS,
      ]),
      redisCommand(redis, [
        "SET",
        sequenceKey(record.id),
        0,
        "EX",
        SESSION_TTL_SECONDS,
      ]),
      redisCommand(redis, [
        "SET",
        activeSessionKey(),
        record.id,
        "EX",
        SESSION_TTL_SECONDS,
      ]),
    ]);
  } else {
    sessions.set(record.id, record);
    brokerGlobal.__activeTeacherSessionId = record.id;
  }
  return {
    sessionId: record.id,
    token: record.token,
    expiresAt: record.expiresAt,
    liveMcpConfigured: Boolean(process.env.TEACHER_MCP_PUBLIC_URL?.trim()),
  };
}

export async function authorizeTeacherSession(
  sessionId: string,
  token: string,
): Promise<boolean> {
  if (!sessionId || !token) return false;
  const record = await getStoredSession(sessionId);
  return Boolean(
    record && record.expiresAt > Date.now() && tokensMatch(record.token, token),
  );
}

export async function publishTeacherCommand(
  sessionId: string,
  token: string,
  command: TeacherDrawRequest,
): Promise<TeacherCommandEvent | null> {
  const record = await getStoredSession(sessionId);
  if (!record || !tokensMatch(record.token, token)) return null;

  const redis = getRedisConfig();
  if (redis) {
    const eventId = Number(
      await redisCommand<number | string>(redis, [
        "INCR",
        sequenceKey(sessionId),
      ]),
    );
    const event: TeacherCommandEvent = { eventId, command };
    await redisCommand(redis, [
      "RPUSH",
      eventsKey(sessionId),
      JSON.stringify(event),
    ]);
    await Promise.all([
      redisCommand(redis, [
        "LTRIM",
        eventsKey(sessionId),
        -REPLAY_LIMIT,
        -1,
      ]),
      redisCommand(redis, [
        "EXPIRE",
        eventsKey(sessionId),
        SESSION_TTL_SECONDS,
      ]),
    ]);
    return event;
  }

  const event: TeacherCommandEvent = {
    eventId: record.nextEventId,
    command,
  };
  record.nextEventId += 1;
  record.replay = [...record.replay, event].slice(-REPLAY_LIMIT);
  return event;
}

export async function publishTeacherCommandToActiveSession(
  command: TeacherDrawRequest,
): Promise<{ sessionId: string; event: TeacherCommandEvent } | null> {
  purgeExpiredSessions();
  const redis = getRedisConfig();
  const sessionId = redis
    ? await redisCommand<string | null>(redis, ["GET", activeSessionKey()])
    : brokerGlobal.__activeTeacherSessionId ?? null;
  if (!sessionId) return null;
  const record = await getStoredSession(sessionId);
  if (!record) return null;
  const event = await publishTeacherCommand(sessionId, record.token, command);
  return event ? { sessionId, event } : null;
}

export async function getTeacherSessionEvents(
  sessionId: string,
  token: string,
  afterEventId: number,
): Promise<TeacherCommandEvent[] | null> {
  const record = await getStoredSession(sessionId);
  if (!record || !tokensMatch(record.token, token)) return null;
  const redis = getRedisConfig();
  if (!redis) {
    brokerGlobal.__activeTeacherSessionId = record.id;
    return record.replay.filter((event) => event.eventId > afterEventId);
  }
  await redisCommand(redis, [
    "SET",
    activeSessionKey(),
    record.id,
    "EX",
    SESSION_TTL_SECONDS,
  ]);
  const rawEvents = await redisCommand<string[]>(redis, [
    "LRANGE",
    eventsKey(sessionId),
    0,
    -1,
  ]);
  return rawEvents.flatMap((raw) => {
    try {
      const event = JSON.parse(raw) as TeacherCommandEvent;
      return event.eventId > afterEventId ? [event] : [];
    } catch {
      return [];
    }
  });
}

export async function closeTeacherSession(
  sessionId: string,
  token: string,
): Promise<boolean> {
  const record = await getStoredSession(sessionId);
  if (!record || !tokensMatch(record.token, token)) return false;
  const redis = getRedisConfig();
  if (redis) {
    await redisCommand(redis, [
      "DEL",
      sessionKey(sessionId),
      sequenceKey(sessionId),
      eventsKey(sessionId),
    ]);
    const active = await redisCommand<string | null>(redis, [
      "GET",
      activeSessionKey(),
    ]);
    if (active === sessionId) {
      await redisCommand(redis, ["DEL", activeSessionKey()]);
    }
  } else {
    sessions.delete(sessionId);
    if (brokerGlobal.__activeTeacherSessionId === sessionId) {
      brokerGlobal.__activeTeacherSessionId = undefined;
    }
  }
  return true;
}

export async function consumeTeacherRateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const key = `${REDIS_PREFIX}:rate:${bucket}`;
  const redis = getRedisConfig();
  if (redis) {
    const count = Number(
      await redisCommand<number | string>(redis, ["INCR", key]),
    );
    if (count === 1) {
      await redisCommand(redis, ["EXPIRE", key, windowSeconds]);
    }
    return count <= limit;
  }

  purgeExpiredSessions();
  const current = rateLimits.get(key);
  if (!current) {
    rateLimits.set(key, {
      count: 1,
      expiresAt: Date.now() + windowSeconds * 1000,
    });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}
