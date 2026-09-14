"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyTeacherCommand,
  clearTeacherBoard,
  INITIAL_TEACHER_BOARD_STATE,
} from "@/lib/teacher/boardReducer";
import { PHOTOSYNTHESIS_DEMO } from "@/lib/teacher/demoLesson";
import type { EAgentState } from "@/types/agora";
import type {
  TeacherBoardState,
  TeacherCommandEvent,
  TeacherConnectionState,
  TeacherSessionCredentials,
} from "@/types/teacher";

const RECONNECT_MIN_MS = 500;
const RECONNECT_MAX_MS = 10_000;
const DEMO_STEP_MS = 680;

export interface UseTeacherBoardSessionResult {
  session: TeacherSessionCredentials | null;
  boardState: TeacherBoardState;
  connection: TeacherConnectionState;
  activeAnimation: "progressive" | "instant";
  playDemo(): Promise<void>;
  pauseDemo(): void;
  resumeDemo(): void;
  clearBoard(): void;
}

export interface UseTeacherBoardSessionOptions {
  connectRemote?: boolean;
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export function useTeacherBoardSession(
  _agentState: EAgentState,
  options: UseTeacherBoardSessionOptions = {},
): UseTeacherBoardSessionResult {
  const connectRemote = options.connectRemote ?? true;
  const [session, setSession] = useState<TeacherSessionCredentials | null>(null);
  const [boardState, setBoardState] = useState<TeacherBoardState>(
    INITIAL_TEACHER_BOARD_STATE,
  );
  const [connection, setConnection] =
    useState<TeacherConnectionState>(
      connectRemote ? "connecting" : "demo",
    );
  const [activeAnimation, setActiveAnimation] = useState<
    "progressive" | "instant"
  >("instant");
  const mountedRef = useRef(true);
  const sessionRef = useRef<TeacherSessionCredentials | null>(null);
  const lastEventIdRef = useRef(0);
  const demoTokenRef = useRef(0);
  const demoIndexRef = useRef(0);
  const demoPausedRef = useRef(false);
  const demoRunningRef = useRef(false);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    reduceMotionRef.current =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const pauseDemo = useCallback(() => {
    demoPausedRef.current = true;
    demoRunningRef.current = false;
    demoTokenRef.current += 1;
    setActiveAnimation("instant");
  }, []);

  const runDemo = useCallback(async (restart: boolean): Promise<void> => {
    const token = demoTokenRef.current + 1;
    demoTokenRef.current = token;
    demoPausedRef.current = false;
    demoRunningRef.current = true;
    setConnection("demo");

    if (restart) {
      demoIndexRef.current = 0;
      setBoardState((current) => clearTeacherBoard(current));
    }

    while (demoIndexRef.current < PHOTOSYNTHESIS_DEMO.length) {
      if (
        !mountedRef.current ||
        demoTokenRef.current !== token ||
        demoPausedRef.current
      ) {
        demoRunningRef.current = false;
        return;
      }

      const event = PHOTOSYNTHESIS_DEMO[demoIndexRef.current];
      setActiveAnimation(
        reduceMotionRef.current ? "instant" : event.command.animation,
      );
      setBoardState((current) => applyTeacherCommand(current, event));
      demoIndexRef.current += 1;
      if (!reduceMotionRef.current) await wait(DEMO_STEP_MS);
    }
    demoRunningRef.current = false;
  }, []);

  const playDemo = useCallback(() => runDemo(true), [runDemo]);

  const resumeDemo = useCallback(() => {
    if (
      demoRunningRef.current ||
      demoIndexRef.current >= PHOTOSYNTHESIS_DEMO.length
    ) {
      return;
    }
    void runDemo(false);
  }, [runDemo]);

  const clearBoard = useCallback(() => {
    pauseDemo();
    demoIndexRef.current = 0;
    setBoardState((current) => clearTeacherBoard(current));
  }, [pauseDemo]);

  useEffect(() => {
    mountedRef.current = true;

    if (!connectRemote) {
      return () => {
        mountedRef.current = false;
        pauseDemo();
      };
    }

    let disposed = false;
    let credentials: TeacherSessionCredentials | null = null;

    void (async () => {
      try {
        const response = await fetch("/api/teacher/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Teacher session unavailable.");
        credentials = (await response.json()) as TeacherSessionCredentials;
        if (disposed) {
          void fetch(
            `/api/teacher/session?sessionId=${encodeURIComponent(credentials.sessionId)}`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${credentials.token}` },
              keepalive: true,
            },
          ).catch(() => undefined);
          return;
        }
        sessionRef.current = credentials;
        setSession(credentials);
      } catch (error) {
        console.warn("Unable to create teacher board session", error);
        if (!disposed) setConnection("offline");
      }
    })();

    return () => {
      disposed = true;
      mountedRef.current = false;
      pauseDemo();
      const activeSession = credentials ?? sessionRef.current;
      if (!activeSession) return;
      void fetch(
        `/api/teacher/session?sessionId=${encodeURIComponent(activeSession.sessionId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${activeSession.token}` },
          keepalive: true,
        },
      ).catch(() => undefined);
      sessionRef.current = null;
    };
  }, [connectRemote, pauseDemo]);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    let disposed = false;

    const applyEvent = (event: TeacherCommandEvent): void => {
      pauseDemo();
      setConnection("live");
      lastEventIdRef.current = Math.max(
        lastEventIdRef.current,
        event.eventId,
      );
      setActiveAnimation(
        reduceMotionRef.current
          ? "instant"
          : event.command.animation,
      );
      setBoardState((current) => applyTeacherCommand(current, event));
    };

    const connect = async (): Promise<void> => {
      let reconnectDelay = RECONNECT_MIN_MS;
      if (!demoRunningRef.current) setConnection("connecting");
      while (!disposed && !controller.signal.aborted) {
        try {
          const search = new URLSearchParams({
            sessionId: session.sessionId,
            afterEventId: String(lastEventIdRef.current),
          });
          const response = await fetch(`/api/teacher/events?${search}`, {
            headers: { Authorization: `Bearer ${session.token}` },
            cache: "no-store",
            signal: controller.signal,
          });
          if (!response.ok) {
            throw new Error(`Teacher event poll returned ${response.status}.`);
          }
          const payload = (await response.json()) as {
            events?: TeacherCommandEvent[];
          };
          reconnectDelay = RECONNECT_MIN_MS;
          if (!demoRunningRef.current) {
            setConnection("live");
          }
          for (const event of payload.events ?? []) applyEvent(event);
          await wait(RECONNECT_MIN_MS, controller.signal);
          continue;
        } catch (error) {
          if (controller.signal.aborted || disposed) return;
          console.warn("Teacher board event poll failed", error);
          if (!demoRunningRef.current) {
            setConnection("offline");
          }
        }

        await wait(reconnectDelay, controller.signal);
        reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
      }
    };

    void connect();
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [pauseDemo, session]);

  return {
    session,
    boardState,
    connection,
    activeAnimation,
    playDemo,
    pauseDemo,
    resumeDemo,
    clearBoard,
  };
}
