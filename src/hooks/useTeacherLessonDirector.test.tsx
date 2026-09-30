import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INITIAL_TEACHER_BOARD_STATE } from "@/lib/teacher/boardReducer";
import { EAgentState, ETurnStatus } from "@/types/agora";

const mocks = vi.hoisted(() => ({
  speakAgent: vi.fn().mockResolvedValue(undefined),
  interruptAgent: vi.fn().mockResolvedValue(undefined),
  publishTeacherCue: vi.fn().mockResolvedValue({ eventId: 1 }),
}));

vi.mock("@/api/agentApi", () => mocks);

import { useTeacherLessonDirector } from "./useTeacherLessonDirector";

describe("useTeacherLessonDirector", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reports an expected planner rejection without opening a dev error overlay", async () => {
    vi.useRealTimers();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "Teacher lesson planner returned an invalid response.",
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      ),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { result } = renderHook(() =>
      useTeacherLessonDirector({
        active: true,
        agentId: "agent-1",
        agentState: EAgentState.LISTENING,
        localUID: "42",
        transcriptItems: [],
        teacherSession: {
          sessionId: "session-1",
          token: "token-1",
          expiresAt: Date.now() + 60_000,
          liveMcpConfigured: true,
        },
        boardState: INITIAL_TEACHER_BOARD_STATE,
        clearBoard: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.sendTeacherQuestion("Explain the agent loop");
    });

    expect(result.current.status).toBe("error");
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("waits for the complete revision of an unfinished voice question", async () => {
    const incompleteTurn = {
      uid: "42",
      stream_id: 7,
      turn_id: 11,
      _time: 1,
      text: "How does",
      status: ETurnStatus.END,
      metadata: null,
    };
    const { rerender } = renderHook(
      ({ transcriptItems }) =>
        useTeacherLessonDirector({
          active: true,
          agentId: "agent-1",
          agentState: EAgentState.LISTENING,
          localUID: "42",
          transcriptItems,
          teacherSession: {
            sessionId: "session-1",
            token: "token-1",
            expiresAt: Date.now() + 60_000,
            liveMcpConfigured: true,
          },
          boardState: INITIAL_TEACHER_BOARD_STATE,
          clearBoard: vi.fn(),
        }),
      { initialProps: { transcriptItems: [incompleteTurn] } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(fetch).not.toHaveBeenCalled();

    rerender({
      transcriptItems: [
        {
          ...incompleteTurn,
          _time: 2,
          text: "How does an AI agent work?",
        },
      ],
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const request = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toMatchObject({
      question: "How does an AI agent work?",
    });
  });
});
