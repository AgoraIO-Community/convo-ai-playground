import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AgoraVoiceAIEvents,
  CovSubRenderController,
  MessageType,
  ModuleType,
  TranscriptHelperMode,
  TurnStatus,
  type AgoraVoiceAIConfig,
  type AgoraVoiceAIEventHandlers,
  type TranscriptHelperItem,
  type UserTranscription,
  type AgentTranscription,
} from "agora-agent-client-toolkit";
import {
  EAgentState,
  ETurnStatus,
  ETranscriptRenderMode,
} from "@/types/agora";
import {
  normalizeToolkitTranscript,
  startAgoraClientToolkit,
  toToolkitRenderMode,
  type ToolkitClient,
} from "./clientToolkitAdapter";

type TranscriptItem = TranscriptHelperItem<
  Partial<UserTranscription | AgentTranscription>
>;

class FakeToolkitClient implements ToolkitClient {
  private handlers = new Map<
    AgoraVoiceAIEvents,
    Set<(...args: never[]) => void>
  >();

  public isSubscribed = false;
  public isDestroyed = false;
  public subscribeCount = 0;
  public manualSosCalls: Array<{ agentUserId: string; requestId?: string }> = [];
  public manualEosCalls: Array<{ agentUserId: string; requestId?: string }> = [];

  on<Event extends AgoraVoiceAIEvents>(
    event: Event,
    handler: AgoraVoiceAIEventHandlers[Event],
  ): this {
    const eventHandlers = this.handlers.get(event) ?? new Set();
    eventHandlers.add(handler as (...args: never[]) => void);
    this.handlers.set(event, eventHandlers);
    return this;
  }

  off<Event extends AgoraVoiceAIEvents>(
    event: Event,
    handler: AgoraVoiceAIEventHandlers[Event],
  ): this {
    this.handlers.get(event)?.delete(handler as (...args: never[]) => void);
    return this;
  }

  subscribeMessage(): void {
    if (
      !this.handlers.has(AgoraVoiceAIEvents.TRANSCRIPT_UPDATED) ||
      !this.handlers.has(AgoraVoiceAIEvents.AGENT_STATE_CHANGED)
    ) {
      throw new Error("listeners must be registered before subscription");
    }
    this.isSubscribed = true;
    this.subscribeCount += 1;
  }

  unsubscribe(): void {
    this.isSubscribed = false;
  }

  destroy(): void {
    this.isDestroyed = true;
    this.handlers.clear();
  }

  async chat(): Promise<void> {}

  async manualSOS(agentUserId: string, requestId?: string): Promise<string> {
    this.manualSosCalls.push({ agentUserId, requestId });
    return requestId ?? "generated-sos";
  }

  async manualEOS(agentUserId: string, requestId?: string): Promise<string> {
    this.manualEosCalls.push({ agentUserId, requestId });
    return requestId ?? "generated-eos";
  }

  emit<Event extends AgoraVoiceAIEvents>(
    event: Event,
    ...args: Parameters<AgoraVoiceAIEventHandlers[Event]>
  ): void {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(...(args as never[]));
    }
  }
}

function createFakeRtcEngine() {
  const handlers = new Map<string, Set<(value: number) => void>>();
  return {
    on(event: string, handler: (value: number) => void) {
      const eventHandlers = handlers.get(event) ?? new Set();
      eventHandlers.add(handler);
      handlers.set(event, eventHandlers);
    },
    off(event: string, handler: (value: number) => void) {
      handlers.get(event)?.delete(handler);
    },
    emit(event: string, value: number) {
      for (const handler of handlers.get(event) ?? []) handler(value);
    },
  };
}

describe("normalizeToolkitTranscript", () => {
  it("replaces history with sorted completed turns and one active turn", () => {
    const result = normalizeToolkitTranscript([
      {
        uid: "agent-7",
        stream_id: 0,
        turn_id: 4,
        _time: 400,
        text: "Still speaking",
        status: ETurnStatus.IN_PROGRESS,
        metadata: { object: "assistant.transcription" },
      },
      {
        uid: "agent-7",
        stream_id: 0,
        turn_id: 3,
        _time: 300,
        text: "Second",
        status: ETurnStatus.END,
        metadata: { object: "assistant.transcription" },
      },
      {
        uid: "42",
        stream_id: 0,
        turn_id: 1,
        _time: 100,
        text: "First",
        status: ETurnStatus.END,
        metadata: { object: "user.transcription" },
      },
    ]);

    expect(result.completed.map((item) => item.turn_id)).toEqual([1, 3]);
    expect(result.inProgress).toMatchObject({
      uid: "agent-7",
      turn_id: 4,
      text: "Still speaking",
      status: ETurnStatus.IN_PROGRESS,
    });
  });

  it("drops empty transport updates without retaining old history", () => {
    expect(
      normalizeToolkitTranscript([
        {
          uid: "agent-7",
          stream_id: 0,
          turn_id: 9,
          _time: 900,
          text: "   ",
          status: ETurnStatus.END,
          metadata: { object: "assistant.transcription" },
        },
      ]),
    ).toEqual({ completed: [], inProgress: null });

    expect(normalizeToolkitTranscript([])).toEqual({
      completed: [],
      inProgress: null,
    });
  });

  it("uses transcription metadata to distinguish a user echo from agent UID zero", () => {
    const result = normalizeToolkitTranscript(
      [
        {
          uid: "0",
          stream_id: 0,
          turn_id: 4,
          _time: 400,
          text: "bye",
          status: TurnStatus.END,
          metadata: {
            object: MessageType.USER_TRANSCRIPTION,
            text: "bye",
          },
        },
        {
          uid: "0",
          stream_id: 0,
          turn_id: 4,
          _time: 500,
          text: "Goodbye!",
          status: TurnStatus.END,
          metadata: {
            object: MessageType.AGENT_TRANSCRIPTION,
            text: "Goodbye!",
          },
        },
      ],
      { localRtcUid: "42" },
    );

    expect(result.completed).toMatchObject([
      { uid: "42", text: "bye" },
      { uid: "0", text: "Goodbye!" },
    ]);
  });

  it("reveals agent words from RTC PTS and falls back to complete text without PTS", () => {
    const history: TranscriptItem[] = [
      {
        uid: "0",
        stream_id: 0,
        turn_id: 7,
        _time: 500,
        text: "Hello world",
        status: TurnStatus.END,
        metadata: {
          object: MessageType.AGENT_TRANSCRIPTION,
          text: "Hello world",
          words: [
            { word: "Hello", start_ms: 100, duration_ms: 80, stable: true },
            { word: " world", start_ms: 250, duration_ms: 80, stable: true },
          ],
        },
      },
    ];

    expect(
      normalizeToolkitTranscript(history, {
        pts: 100,
        useWordTiming: true,
      }).inProgress,
    ).toMatchObject({ text: "Hello", status: ETurnStatus.IN_PROGRESS });
    expect(
      normalizeToolkitTranscript(history, {
        pts: 250,
        useWordTiming: true,
      }).completed[0],
    ).toMatchObject({ text: "Hello world", status: ETurnStatus.END });
    expect(normalizeToolkitTranscript(history).completed[0]).toMatchObject({
      text: "Hello world",
      status: ETurnStatus.END,
    });
  });
});

describe("toToolkitRenderMode", () => {
  it.each([
    [ETranscriptRenderMode.TEXT, TranscriptHelperMode.TEXT],
    [ETranscriptRenderMode.WORD, TranscriptHelperMode.WORD],
    [ETranscriptRenderMode.AUTO, TranscriptHelperMode.AUTO],
  ])("maps %s to the toolkit mode", (appMode, expected) => {
    expect(toToolkitRenderMode(appMode)).toBe(expected);
  });
});

describe("startAgoraClientToolkit", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes RTC data-stream transcripts without RTM config", async () => {
    const client = new FakeToolkitClient();
    const rtcEngine = createFakeRtcEngine();
    const snapshots: ReturnType<typeof normalizeToolkitTranscript>[] = [];
    let initConfig: AgoraVoiceAIConfig | null = null;

    const session = await startAgoraClientToolkit(
      {
        rtcEngine,
        rtmEngine: null,
        channelId: "channel-rtc",
        localRtcUid: "42",
        renderMode: ETranscriptRenderMode.TEXT,
        onTranscript: (snapshot) => snapshots.push(snapshot),
        onAgentState() {},
      },
      {
        init: async (config) => {
          initConfig = config;
          return client;
        },
      },
    );

    expect(initConfig).not.toHaveProperty("rtmConfig");
    expect(client.isSubscribed).toBe(true);

    client.emit(AgoraVoiceAIEvents.TRANSCRIPT_UPDATED, [
      {
        uid: "agent-7",
        stream_id: 0,
        turn_id: 12,
        _time: 500,
        text: "RTC transcript",
        status: TurnStatus.END,
        metadata: {
          object: MessageType.AGENT_TRANSCRIPTION,
          text: "RTC transcript",
        },
      } satisfies TranscriptItem,
    ]);

    expect(snapshots.at(-1)?.completed[0]).toMatchObject({
      text: "RTC transcript",
      status: ETurnStatus.END,
    });

    session.destroy();
  });

  it("delivers normalized transcript and agent state after safe subscription", async () => {
    const client = new FakeToolkitClient();
    const rtcHandlers = new Map<string, Set<(value: number) => void>>();
    const rtcEngine = {
      on(event: string, handler: (value: number) => void) {
        const handlers = rtcHandlers.get(event) ?? new Set();
        handlers.add(handler);
        rtcHandlers.set(event, handlers);
      },
      off(event: string, handler: (value: number) => void) {
        rtcHandlers.get(event)?.delete(handler);
      },
      emit(event: string, value: number) {
        for (const handler of rtcHandlers.get(event) ?? []) handler(value);
      },
    };
    const snapshots: ReturnType<typeof normalizeToolkitTranscript>[] = [];
    const states: EAgentState[] = [];
    let initConfig: AgoraVoiceAIConfig | null = null;

    const session = await startAgoraClientToolkit(
      {
        rtcEngine,
        rtmEngine: {
          publish: async () => undefined,
          addEventListener() {},
          removeEventListener() {},
        },
        channelId: "channel-1",
        localRtcUid: "42",
        renderMode: ETranscriptRenderMode.WORD,
        onTranscript: (snapshot) => snapshots.push(snapshot),
        onAgentState: (state) => states.push(state),
      },
      {
        init: async (config) => {
          initConfig = config;
          return client;
        },
      },
    );

    expect(client.isSubscribed).toBe(true);
    expect(initConfig).toMatchObject({
      renderMode: TranscriptHelperMode.TEXT,
      enableLog: false,
    });

    rtcEngine.emit("audio-pts", 500);

    client.emit(AgoraVoiceAIEvents.TRANSCRIPT_UPDATED, [
      {
        uid: "agent-7",
        stream_id: 0,
        turn_id: 5,
        _time: 500,
        text: "Hello",
        status: TurnStatus.IN_PROGRESS,
        metadata: {
          object: MessageType.AGENT_TRANSCRIPTION,
          text: "Hello",
          words: [
            { word: "Hello", start_ms: 500, duration_ms: 80, stable: true },
          ],
        },
      } satisfies TranscriptItem,
    ]);
    client.emit(AgoraVoiceAIEvents.AGENT_STATE_CHANGED, "agent-7", {
      state: EAgentState.SPEAKING,
      turnID: 5,
      timestamp: 500,
      reason: "tts",
    });

    expect(snapshots.at(-1)?.inProgress).toMatchObject({
      uid: "agent-7",
      text: "Hello",
      status: ETurnStatus.IN_PROGRESS,
    });
    expect(states).toEqual([EAgentState.SPEAKING]);

    session.destroy();
    expect(client.isSubscribed).toBe(false);
    expect(client.isDestroyed).toBe(true);

    client.emit(AgoraVoiceAIEvents.AGENT_STATE_CHANGED, "agent-7", {
      state: EAgentState.IDLE,
      turnID: 5,
      timestamp: 600,
      reason: "done",
    });
    expect(states).toEqual([EAgentState.SPEAKING]);
  });

  it("forwards v2.11 metrics, pipeline errors, chat errors, and manual turn results", async () => {
    const client = new FakeToolkitClient();
    const metrics: unknown[] = [];
    const agentErrors: unknown[] = [];
    const messageErrors: unknown[] = [];
    const manualResults: unknown[] = [];
    const session = await startAgoraClientToolkit(
      {
        rtcEngine: createFakeRtcEngine(),
        rtmEngine: {
          publish: async () => undefined,
          addEventListener() {},
          removeEventListener() {},
        },
        channelId: "channel-1",
        localRtcUid: "42",
        renderMode: ETranscriptRenderMode.TEXT,
        onTranscript() {},
        onAgentState() {},
        onAgentMetric: (event) => metrics.push(event),
        onAgentError: (event) => agentErrors.push(event),
        onMessageError: (event) => messageErrors.push(event),
        onManualTurnResult: (event) => manualResults.push(event),
      },
      { init: async () => client },
    );

    client.emit(AgoraVoiceAIEvents.AGENT_METRICS, "agent-7", {
      type: ModuleType.LLM,
      name: "first_token_latency",
      value: 245,
      timestamp: 100,
    });
    client.emit(AgoraVoiceAIEvents.AGENT_ERROR, "agent-7", {
      type: ModuleType.TTS,
      code: 5001,
      message: "TTS unavailable",
      timestamp: 110,
    });
    client.emit(AgoraVoiceAIEvents.MESSAGE_ERROR, "agent-7", {
      type: "text",
      code: 4001,
      message: "Message rejected",
      timestamp: 120,
    });
    client.emit(AgoraVoiceAIEvents.USER_MANUAL_SOS, "agent-7", {
      eventId: "evt-sos",
      timestamp: 130,
      payload: {
        success: true,
        requestId: "req-sos",
        turnId: 8,
        errorMessage: null,
      },
    });
    client.emit(AgoraVoiceAIEvents.USER_MANUAL_EOS, "agent-7", {
      eventId: "evt-eos",
      timestamp: 140,
      payload: {
        success: false,
        requestId: "req-eos",
        turnId: null,
        errorMessage: "No turns available for EOS labeling.",
      },
    });
    client.emit(AgoraVoiceAIEvents.AGENT_MANUAL_EOS, "agent-7", {
      eventId: "evt-auto-eos",
      timestamp: 150,
      payload: { reason: "timeout", maxDurationMs: 30000, turnId: 8 },
    });

    expect(metrics).toEqual([
      {
        agentUserId: "agent-7",
        metric: expect.objectContaining({ name: "first_token_latency" }),
      },
    ]);
    expect(agentErrors).toEqual([
      {
        agentUserId: "agent-7",
        error: expect.objectContaining({ code: 5001 }),
      },
    ]);
    expect(messageErrors).toEqual([
      {
        agentUserId: "agent-7",
        error: expect.objectContaining({ code: 4001 }),
      },
    ]);
    expect(manualResults).toEqual([
      expect.objectContaining({ kind: "user_sos", agentUserId: "agent-7" }),
      expect.objectContaining({ kind: "user_eos", agentUserId: "agent-7" }),
      expect.objectContaining({ kind: "agent_eos", agentUserId: "agent-7" }),
    ]);

    session.destroy();
    client.emit(AgoraVoiceAIEvents.AGENT_METRICS, "agent-7", {
      type: ModuleType.LLM,
      name: "late",
      value: 1,
      timestamp: 200,
    });
    expect(metrics).toHaveLength(1);
  });

  it("delegates manual SOS and EOS and returns their request IDs", async () => {
    const client = new FakeToolkitClient();
    const session = await startAgoraClientToolkit(
      {
        rtcEngine: createFakeRtcEngine(),
        rtmEngine: {
          publish: async () => undefined,
          addEventListener() {},
          removeEventListener() {},
        },
        channelId: "channel-1",
        localRtcUid: "42",
        renderMode: ETranscriptRenderMode.TEXT,
        onTranscript() {},
        onAgentState() {},
      },
      { init: async () => client },
    );

    await expect(session.manualSOS("agent-7", "sos-1")).resolves.toBe("sos-1");
    await expect(session.manualEOS("agent-7")).resolves.toBe("generated-eos");
    expect(client.manualSosCalls).toEqual([
      { agentUserId: "agent-7", requestId: "sos-1" },
    ]);
    expect(client.manualEosCalls).toEqual([
      { agentUserId: "agent-7", requestId: undefined },
    ]);

    session.destroy();
  });

  it("waits for delayed audio PTS before revealing a word-timed agent turn", async () => {
    vi.useFakeTimers();
    const client = new FakeToolkitClient();
    const rtcHandlers = new Map<string, Set<(value: number) => void>>();
    const rtcEngine = {
      on(event: string, handler: (value: number) => void) {
        const handlers = rtcHandlers.get(event) ?? new Set();
        handlers.add(handler);
        rtcHandlers.set(event, handlers);
      },
      off(event: string, handler: (value: number) => void) {
        rtcHandlers.get(event)?.delete(handler);
      },
      emit(event: string, value: number) {
        for (const handler of rtcHandlers.get(event) ?? []) handler(value);
      },
    };
    const snapshots: ReturnType<typeof normalizeToolkitTranscript>[] = [];

    const session = await startAgoraClientToolkit(
      {
        rtcEngine,
        rtmEngine: {
          publish: async () => undefined,
          addEventListener() {},
          removeEventListener() {},
        },
        channelId: "channel-1",
        localRtcUid: "42",
        renderMode: ETranscriptRenderMode.WORD,
        onTranscript: (snapshot) => snapshots.push(snapshot),
        onAgentState() {},
      },
      { init: async () => client },
    );

    client.emit(AgoraVoiceAIEvents.TRANSCRIPT_UPDATED, [
      {
        uid: "agent-7",
        stream_id: 0,
        turn_id: 8,
        _time: 500,
        text: "Hello world",
        status: TurnStatus.END,
        metadata: {
          object: MessageType.AGENT_TRANSCRIPTION,
          text: "Hello world",
          words: [
            { word: "Hello", start_ms: 100, duration_ms: 80, stable: true },
            { word: " world", start_ms: 250, duration_ms: 80, stable: true },
          ],
        },
      } satisfies TranscriptItem,
    ]);

    expect(snapshots).toEqual([]);

    rtcEngine.emit("audio-pts", 100);
    expect(snapshots.at(-1)?.inProgress).toMatchObject({
      text: "Hello",
      status: ETurnStatus.IN_PROGRESS,
    });

    session.destroy();
  });

  it("falls back to complete text when audio PTS does not arrive", async () => {
    vi.useFakeTimers();
    const client = new FakeToolkitClient();
    const rtcEngine = createFakeRtcEngine();
    const snapshots: ReturnType<typeof normalizeToolkitTranscript>[] = [];

    const session = await startAgoraClientToolkit(
      {
        rtcEngine,
        rtmEngine: {
          publish: async () => undefined,
          addEventListener() {},
          removeEventListener() {},
        },
        channelId: "channel-1",
        localRtcUid: "42",
        renderMode: ETranscriptRenderMode.WORD,
        onTranscript: (snapshot) => snapshots.push(snapshot),
        onAgentState() {},
      },
      { init: async () => client },
    );

    client.emit(AgoraVoiceAIEvents.TRANSCRIPT_UPDATED, [
      {
        uid: "agent-7",
        stream_id: 0,
        turn_id: 9,
        _time: 500,
        text: "Hello world",
        status: TurnStatus.END,
        metadata: {
          object: MessageType.AGENT_TRANSCRIPTION,
          text: "Hello world",
          words: [
            { word: "Hello", start_ms: 100, duration_ms: 80, stable: true },
            { word: " world", start_ms: 250, duration_ms: 80, stable: true },
          ],
        },
      } satisfies TranscriptItem,
    ]);

    expect(snapshots).toEqual([]);
    vi.advanceTimersByTime(5_000);
    expect(snapshots.at(-1)?.completed[0]).toMatchObject({
      text: "Hello world",
      status: ETurnStatus.END,
    });

    session.destroy();
  });

  it("cancels a pending word-timing fallback when the session is destroyed", async () => {
    vi.useFakeTimers();
    const client = new FakeToolkitClient();
    const rtcEngine = createFakeRtcEngine();
    const snapshots: ReturnType<typeof normalizeToolkitTranscript>[] = [];

    const session = await startAgoraClientToolkit(
      {
        rtcEngine,
        rtmEngine: {
          publish: async () => undefined,
          addEventListener() {},
          removeEventListener() {},
        },
        channelId: "channel-1",
        localRtcUid: "42",
        renderMode: ETranscriptRenderMode.WORD,
        onTranscript: (snapshot) => snapshots.push(snapshot),
        onAgentState() {},
      },
      { init: async () => client },
    );

    client.emit(AgoraVoiceAIEvents.TRANSCRIPT_UPDATED, [
      {
        uid: "agent-7",
        stream_id: 0,
        turn_id: 10,
        _time: 500,
        text: "Goodbye",
        status: TurnStatus.END,
        metadata: {
          object: MessageType.AGENT_TRANSCRIPTION,
          text: "Goodbye",
          words: [
            { word: "Goodbye", start_ms: 100, duration_ms: 200, stable: true },
          ],
        },
      } satisfies TranscriptItem,
    ]);

    session.destroy();
    vi.advanceTimersByTime(5_000);

    expect(snapshots).toEqual([]);
  });

  it("emits complete agent text immediately in text mode", async () => {
    const client = new FakeToolkitClient();
    const rtcEngine = createFakeRtcEngine();
    const snapshots: ReturnType<typeof normalizeToolkitTranscript>[] = [];

    const session = await startAgoraClientToolkit(
      {
        rtcEngine,
        rtmEngine: {
          publish: async () => undefined,
          addEventListener() {},
          removeEventListener() {},
        },
        channelId: "channel-1",
        localRtcUid: "42",
        renderMode: ETranscriptRenderMode.TEXT,
        onTranscript: (snapshot) => snapshots.push(snapshot),
        onAgentState() {},
      },
      { init: async () => client },
    );

    client.emit(AgoraVoiceAIEvents.TRANSCRIPT_UPDATED, [
      {
        uid: "agent-7",
        stream_id: 0,
        turn_id: 11,
        _time: 500,
        text: "Immediate text",
        status: TurnStatus.END,
        metadata: {
          object: MessageType.AGENT_TRANSCRIPTION,
          text: "Immediate text",
          words: [
            { word: "Immediate", start_ms: 100, duration_ms: 100, stable: true },
            { word: " text", start_ms: 220, duration_ms: 80, stable: true },
          ],
        },
      } satisfies TranscriptItem,
    ]);

    expect(snapshots.at(-1)?.completed[0]).toMatchObject({
      text: "Immediate text",
      status: ETurnStatus.END,
    });

    session.destroy();
  });

  it("switches from word to text mode in place and reveals queued text", async () => {
    vi.useFakeTimers();
    const client = new FakeToolkitClient();
    const rtcEngine = createFakeRtcEngine();
    const snapshots: ReturnType<typeof normalizeToolkitTranscript>[] = [];
    const session = await startAgoraClientToolkit(
      {
        rtcEngine,
        channelId: "channel-1",
        localRtcUid: "42",
        renderMode: ETranscriptRenderMode.WORD,
        onTranscript: (snapshot) => snapshots.push(snapshot),
        onAgentState() {},
      },
      { init: async () => client },
    );

    client.emit(AgoraVoiceAIEvents.TRANSCRIPT_UPDATED, [
      {
        uid: "agent-7",
        stream_id: 0,
        turn_id: 13,
        _time: 500,
        text: "Hello world",
        status: TurnStatus.END,
        metadata: {
          object: MessageType.AGENT_TRANSCRIPTION,
          words: [
            { word: "Hello", start_ms: 100, duration_ms: 80, stable: true },
            { word: " world", start_ms: 250, duration_ms: 80, stable: true },
          ],
        },
      } satisfies TranscriptItem,
    ]);
    expect(snapshots).toEqual([]);

    session.setRenderMode(ETranscriptRenderMode.TEXT);

    expect(snapshots.at(-1)?.completed[0]).toMatchObject({
      text: "Hello world",
      status: ETurnStatus.END,
    });
    expect(client.subscribeCount).toBe(1);
    session.destroy();
  });

  it("switches from text to word mode in place using the current audio PTS", async () => {
    const client = new FakeToolkitClient();
    const rtcEngine = createFakeRtcEngine();
    const snapshots: ReturnType<typeof normalizeToolkitTranscript>[] = [];
    const session = await startAgoraClientToolkit(
      {
        rtcEngine,
        channelId: "channel-1",
        localRtcUid: "42",
        renderMode: ETranscriptRenderMode.TEXT,
        onTranscript: (snapshot) => snapshots.push(snapshot),
        onAgentState() {},
      },
      { init: async () => client },
    );

    client.emit(AgoraVoiceAIEvents.TRANSCRIPT_UPDATED, [
      {
        uid: "agent-7",
        stream_id: 0,
        turn_id: 14,
        _time: 500,
        text: "Hello world",
        status: TurnStatus.END,
        metadata: {
          object: MessageType.AGENT_TRANSCRIPTION,
          words: [
            { word: "Hello", start_ms: 100, duration_ms: 80, stable: true },
            { word: " world", start_ms: 250, duration_ms: 80, stable: true },
          ],
        },
      } satisfies TranscriptItem,
    ]);
    rtcEngine.emit("audio-pts", 100);

    session.setRenderMode(ETranscriptRenderMode.WORD);

    expect(snapshots.at(-1)?.inProgress).toMatchObject({
      text: "Hello",
      status: ETurnStatus.IN_PROGRESS,
    });
    expect(client.subscribeCount).toBe(1);
    session.destroy();
  });

  it("keeps visible text while word mode waits for audio PTS", async () => {
    vi.useFakeTimers();
    const client = new FakeToolkitClient();
    const rtcEngine = createFakeRtcEngine();
    const snapshots: ReturnType<typeof normalizeToolkitTranscript>[] = [];
    const session = await startAgoraClientToolkit(
      {
        rtcEngine,
        channelId: "channel-1",
        localRtcUid: "42",
        renderMode: ETranscriptRenderMode.TEXT,
        onTranscript: (snapshot) => snapshots.push(snapshot),
        onAgentState() {},
      },
      { init: async () => client },
    );

    client.emit(AgoraVoiceAIEvents.TRANSCRIPT_UPDATED, [
      {
        uid: "agent-7",
        stream_id: 0,
        turn_id: 15,
        _time: 500,
        text: "Still visible",
        status: TurnStatus.END,
        metadata: {
          object: MessageType.AGENT_TRANSCRIPTION,
          words: [
            { word: "Still", start_ms: 100, duration_ms: 80, stable: true },
            { word: " visible", start_ms: 250, duration_ms: 80, stable: true },
          ],
        },
      } satisfies TranscriptItem,
    ]);

    session.setRenderMode(ETranscriptRenderMode.AUTO);
    expect(snapshots.at(-1)?.completed[0]?.text).toBe("Still visible");
    vi.advanceTimersByTime(5_000);
    expect(snapshots.at(-1)?.completed[0]?.text).toBe("Still visible");

    session.destroy();
  });
});

describe("Agora toolkit PTS integration", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("queues a final transcript received before PTS and reveals it with audio", () => {
    vi.useFakeTimers();
    const snapshots: string[][] = [];
    const controller = new CovSubRenderController({
      onChatHistoryUpdated: (history) => {
        snapshots.push(history.map((item) => item.text));
      },
    });

    controller.run();
    controller.setMode(TranscriptHelperMode.WORD);
    controller.handleMessage(
      {
        object: MessageType.AGENT_TRANSCRIPTION,
        text: "Hello world",
        start_ms: 100,
        duration_ms: 300,
        language: "en",
        turn_id: 7,
        stream_id: 0,
        user_id: "agent-7",
        words: [
          { word: "Hello ", start_ms: 100, duration_ms: 100, stable: true },
          { word: "world", start_ms: 250, duration_ms: 100, stable: true },
        ],
        quiet: false,
        turn_seq_id: 0,
        turn_status: TurnStatus.END,
      },
      { publisher: "agent-7" },
    );

    expect(snapshots).toEqual([]);

    controller.setPts(150);
    vi.advanceTimersByTime(200);
    expect(snapshots.at(-1)).toEqual(["Hello "]);

    controller.setPts(300);
    vi.advanceTimersByTime(200);
    expect(snapshots.at(-1)).toEqual(["Hello world"]);

    controller.cleanup();
  });
});
