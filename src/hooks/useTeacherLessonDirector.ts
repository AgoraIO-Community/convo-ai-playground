"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  interruptAgent,
  publishTeacherCue,
  speakAgent,
} from "@/api/agentApi";
import {
  EAgentState,
  ETurnStatus,
  type ITranscriptHelperItem,
} from "@/types/agora";
import type {
  TeacherBoardState,
  TeacherDrawRequest,
  TeacherLessonContextItem,
  TeacherLessonMode,
  TeacherLessonPlan,
  TeacherLessonProgress,
  TeacherLessonStatus,
  TeacherSessionCredentials,
} from "@/types/teacher";

const BOARD_ACK_TIMEOUT_MS = 3_000;
const POLL_INTERVAL_MS = 25;
const VOICE_COALESCE_MS = 800;
const LOGICAL_DUPLICATE_WINDOW_MS = 5_000;
const RETURN_PHRASE = "Now, let's return to the main idea.";

interface UseTeacherLessonDirectorOptions {
  active: boolean;
  agentId: string | null;
  agentState: EAgentState;
  localUID: number | string | null;
  transcriptItems: ITranscriptHelperItem[];
  teacherSession: TeacherSessionCredentials | null;
  boardState: TeacherBoardState;
  clearBoard(): void;
}

interface UseTeacherLessonDirectorResult {
  status: TeacherLessonStatus;
  progress: TeacherLessonProgress | null;
  sendTeacherQuestion(text: string): Promise<void>;
  cancelLesson(): void;
}

interface LessonFrame {
  plan: TeacherLessonPlan;
  nextCueIndex: number;
}

type ActiveLessonKind = "main" | "clarification" | null;
type CancellationReason =
  | "replace"
  | "clarify"
  | "resume"
  | "pause"
  | "clear"
  | "shutdown";

class TeacherLessonRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "TeacherLessonRequestError";
    this.status = status;
  }
}

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isLessonPlan(value: unknown): value is TeacherLessonPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Partial<TeacherLessonPlan>;
  return (
    typeof plan.turnId === "string" &&
    typeof plan.topic === "string" &&
    Array.isArray(plan.cues) &&
    plan.cues.length > 0 &&
    plan.cues.every(
      (cue) =>
        cue &&
        typeof cue.cueId === "string" &&
        typeof cue.speech === "string" &&
        Array.isArray(cue.boardActions),
    )
  );
}

function normalizeLearnerText(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function areEquivalentTurns(left: string, right: string): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;
  if (shorter.length >= 12 && longer.includes(shorter)) return true;

  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token));
  const union = new Set([...leftTokens, ...rightTokens]);
  return union.size > 0 && intersection.length / union.size >= 0.82;
}

function turnFingerprint(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function isResumeIntent(value: string): boolean {
  return /^(continue|go on|please continue|carry on|resume|keep going)$/.test(
    normalizeLearnerText(value),
  );
}

function isClearBoardIntent(value: string): boolean {
  const normalized = normalizeLearnerText(value);
  return (
    /\b(clear|reset|erase|wipe)\b.*\b(board|blackboard|canvas)\b/.test(
      normalized,
    ) ||
    /\b(start over|start again)\b.*\b(clean|blank|empty)\b.*\b(board|blackboard|canvas)\b/.test(
      normalized,
    )
  );
}

function isStopIntent(value: string): boolean {
  const normalized = normalizeLearnerText(value);
  if (normalized.length > 100) return false;
  if (/\b(don t|do not|never)\s+(stop|pause)\b/.test(normalized)) {
    return false;
  }
  return (
    /^(please\s+)?(stop|pause|hold on|hang on|wait)\b/.test(normalized) ||
    /\b(can|could|would|will) you (please )?(stop|pause|hold on|hang on|wait)\b/.test(
      normalized,
    ) ||
    /\b(that s|that is|thats) enough\b/.test(normalized)
  );
}

function isExplicitTopicReplacement(value: string): boolean {
  return /\b(new topic|switch to|instead|teach me about something else)\b/.test(
    normalizeLearnerText(value),
  );
}

function buildContext(
  transcriptItems: ITranscriptHelperItem[],
  localUID: number | string | null,
): TeacherLessonContextItem[] {
  const localId = String(localUID ?? "");
  return transcriptItems
    .filter(
      (item) =>
        item.status !== ETurnStatus.IN_PROGRESS && item.text.trim().length > 0,
    )
    .slice(-6)
    .map((item) => ({
      role: item.uid === localId ? "user" : "assistant",
      text: item.text.trim().slice(0, 500),
    }));
}

function buildBoardSummary(boardState: TeacherBoardState): string {
  const elements = Object.values(boardState.elements)
    .filter((element) => element.owner === "ai")
    .slice(-40)
    .map((element) => ({
      id: element.id,
      kind: element.kind,
      x: Math.round(element.x),
      y: Math.round(element.y),
      width: Math.round(element.width),
      height: Math.round(element.height),
      text: element.text,
      label: element.label,
    }));
  return JSON.stringify(elements).slice(0, 4_000);
}

async function requestLessonPlan(
  question: string,
  mode: TeacherLessonMode,
  options: UseTeacherLessonDirectorOptions,
  signal: AbortSignal,
  parentTopic?: string,
): Promise<TeacherLessonPlan> {
  if (!options.teacherSession) {
    throw new TeacherLessonRequestError("Teacher board is not ready.", 503);
  }
  const response = await fetch(
    `/api/teacher/lesson?sessionId=${encodeURIComponent(options.teacherSession.sessionId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.teacherSession.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question,
        mode,
        parentTopic,
        context: buildContext(options.transcriptItems, options.localUID),
        boardSummary: buildBoardSummary(options.boardState),
      }),
      signal,
    },
  );
  const body = (await response.json().catch(() => ({}))) as {
    plan?: unknown;
    error?: string;
  };
  if (!response.ok) {
    throw new TeacherLessonRequestError(
      body.error || "Unable to prepare the lesson.",
      response.status,
    );
  }
  if (!isLessonPlan(body.plan)) {
    throw new TeacherLessonRequestError("Invalid lesson plan response.", 502);
  }
  return body.plan;
}

export function useTeacherLessonDirector(
  options: UseTeacherLessonDirectorOptions,
): UseTeacherLessonDirectorResult {
  const [status, setStatus] = useState<TeacherLessonStatus>("idle");
  const [progress, setProgress] = useState<TeacherLessonProgress | null>(null);
  const optionsRef = useRef(options);
  const abortRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const activeKindRef = useRef<ActiveLessonKind>(null);
  const mainFrameRef = useRef<LessonFrame | null>(null);
  const seenVoiceTurnsRef = useRef(new Set<string>());
  const seenVoiceActivityRef = useRef(new Set<string>());
  const pendingVoiceRef = useRef<{ text: string; fingerprint: string } | null>(
    null,
  );
  const voiceTimerRef = useRef<number | null>(null);
  const recentLogicalTurnsRef = useRef<Array<{ text: string; at: number }>>([]);
  optionsRef.current = options;

  const cancelActiveExecution = useCallback(
    (reason: CancellationReason, preserveMain: boolean): boolean => {
      const hadActiveExecution = abortRef.current !== null;
      abortRef.current?.abort();
      abortRef.current = null;
      generationRef.current += 1;
      activeKindRef.current = null;
      if (!preserveMain) mainFrameRef.current = null;
      console.info("[teacher-director] execution cancelled", {
        reason,
        hadActiveExecution,
        resumeAt: mainFrameRef.current?.nextCueIndex ?? null,
      });
      return hadActiveExecution;
    },
    [],
  );

  const cancelLesson = useCallback(() => {
    cancelActiveExecution("shutdown", false);
    if (voiceTimerRef.current !== null) {
      window.clearTimeout(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    pendingVoiceRef.current = null;
    setProgress(null);
    setStatus("idle");
  }, [cancelActiveExecution]);

  const interruptCurrentSpeech = useCallback(async (): Promise<void> => {
    const currentAgentId = optionsRef.current.agentId;
    if (!currentAgentId) return;
    try {
      await interruptAgent(currentAgentId);
    } catch (error) {
      console.warn("[teacher-director] agent interrupt failed", {
        category: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }, []);

  const pauseCurrentLesson = useCallback(async (): Promise<void> => {
    const hasLesson =
      abortRef.current !== null || mainFrameRef.current !== null;
    cancelActiveExecution("pause", true);
    if (voiceTimerRef.current !== null) {
      window.clearTimeout(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    pendingVoiceRef.current = null;
    setProgress(null);
    setStatus(hasLesson ? "paused" : "idle");
    await interruptCurrentSpeech();
  }, [cancelActiveExecution, interruptCurrentSpeech]);

  const clearCurrentLesson = useCallback(async (): Promise<void> => {
    cancelActiveExecution("clear", false);
    if (voiceTimerRef.current !== null) {
      window.clearTimeout(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    pendingVoiceRef.current = null;
    setProgress(null);
    optionsRef.current.clearBoard();
    setStatus("idle");
    await interruptCurrentSpeech();
  }, [cancelActiveExecution, interruptCurrentSpeech]);

  const beginExecution = useCallback(
    (
      reason: CancellationReason,
      preserveMain: boolean,
      kind: Exclude<ActiveLessonKind, null>,
    ): { controller: AbortController; generation: number } => {
      cancelActiveExecution(reason, preserveMain);
      const controller = new AbortController();
      abortRef.current = controller;
      activeKindRef.current = kind;
      return { controller, generation: generationRef.current };
    },
    [cancelActiveExecution],
  );

  const waitForBoardEvent = useCallback(
    async (eventId: number, signal: AbortSignal): Promise<void> => {
      const startedAt = Date.now();
      while (!signal.aborted) {
        if (optionsRef.current.boardState.processedEventIds.includes(eventId)) {
          return;
        }
        if (Date.now() - startedAt >= BOARD_ACK_TIMEOUT_MS) {
          throw new Error("The board did not acknowledge the lesson cue.");
        }
        await wait(POLL_INTERVAL_MS, signal);
      }
      throw new DOMException("Aborted", "AbortError");
    },
    [],
  );

  const waitForSpeech = useCallback(
    async (speech: string, signal: AbortSignal): Promise<void> => {
      const speechBytes = new TextEncoder().encode(speech).byteLength;
      const timeoutMs = Math.min(45_000, Math.max(4_000, speechBytes * 85));
      const startedAt = Date.now();
      let observedSpeaking =
        optionsRef.current.agentState === EAgentState.SPEAKING;

      while (!signal.aborted && Date.now() - startedAt < timeoutMs) {
        const currentState = optionsRef.current.agentState;
        if (currentState === EAgentState.SPEAKING) observedSpeaking = true;
        if (
          observedSpeaking &&
          (currentState === EAgentState.LISTENING ||
            currentState === EAgentState.IDLE ||
            currentState === EAgentState.SILENT)
        ) {
          return;
        }
        await wait(POLL_INTERVAL_MS, signal);
      }
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    },
    [],
  );

  const executePlan = useCallback(
    async (
      plan: TeacherLessonPlan,
      startCueIndex: number,
      mode: TeacherLessonMode,
      controller: AbortController,
      generation: number,
      frame?: LessonFrame,
      interruptFirst = true,
    ): Promise<void> => {
      for (
        let sequence = startCueIndex;
        sequence < plan.cues.length;
        sequence += 1
      ) {
        if (
          controller.signal.aborted ||
          generation !== generationRef.current
        ) {
          throw new DOMException("Aborted", "AbortError");
        }
        const current = optionsRef.current;
        if (!current.agentId || !current.teacherSession || !current.active) {
          throw new TeacherLessonRequestError(
            "Teacher session ended during the lesson.",
            503,
          );
        }

        const cue = plan.cues[sequence];
        const command: TeacherDrawRequest = {
          turnId: plan.turnId,
          sequence,
          animation: "progressive",
          operations: cue.boardActions,
        };
        setProgress({ current: sequence + 1, total: plan.cues.length });
        setStatus(mode === "clarification" ? "clarifying" : "writing");
        const { eventId } = await publishTeacherCue(
          current.teacherSession,
          command,
        );
        // Publication is durable in the shared event broker. Advance the
        // cursor before waiting for the independent board poll so an
        // interruption cannot replay this sequence during that small gap.
        if (frame) frame.nextCueIndex = sequence + 1;
        await waitForBoardEvent(eventId, controller.signal);

        setStatus(mode === "clarification" ? "clarifying" : "explaining");
        await speakAgent({
          agentId: current.agentId,
          text: cue.speech,
          priority:
            interruptFirst && sequence === startCueIndex
              ? "INTERRUPT"
              : "APPEND",
          interruptable: true,
        });
        await waitForSpeech(cue.speech, controller.signal);
        console.info("[teacher-director] cue completed", {
          mode,
          cue: sequence + 1,
          total: plan.cues.length,
        });
      }
    },
    [waitForBoardEvent, waitForSpeech],
  );

  const finishExecution = useCallback(
    (controller: AbortController, generation: number): void => {
      if (
        generation === generationRef.current &&
        abortRef.current === controller
      ) {
        abortRef.current = null;
        activeKindRef.current = null;
      }
    },
    [],
  );

  const handleExecutionError = useCallback(
    (error: unknown, generation: number): void => {
      if (isAbortError(error) || generation !== generationRef.current) return;
      console.error("[teacher-director] lesson execution failed", {
        category: error instanceof Error ? error.name : "UnknownError",
      });
      setStatus(
        error instanceof TeacherLessonRequestError && error.status === 503
          ? "unavailable"
          : "error",
      );
    },
    [],
  );

  const runNewLesson = useCallback(
    async (question: string, _fromVoice: boolean): Promise<void> => {
      const initial = optionsRef.current;
      if (!initial.active || !initial.agentId || !initial.teacherSession) {
        setStatus("unavailable");
        return;
      }
      const { controller, generation } = beginExecution(
        "replace",
        false,
        "main",
      );
      try {
        setProgress(null);
        setStatus("planning");
        const plan = await requestLessonPlan(
          question,
          "lesson",
          optionsRef.current,
          controller.signal,
        );
        const frame: LessonFrame = { plan, nextCueIndex: 0 };
        mainFrameRef.current = frame;
        await executePlan(
          plan,
          0,
          "lesson",
          controller,
          generation,
          frame,
        );
        if (generation === generationRef.current) {
          mainFrameRef.current = null;
          setProgress(null);
          setStatus("idle");
        }
      } catch (error) {
        handleExecutionError(error, generation);
      } finally {
        finishExecution(controller, generation);
      }
    },
    [beginExecution, executePlan, finishExecution, handleExecutionError],
  );

  const resumeMainLesson = useCallback(
    async (announceReturn: boolean): Promise<void> => {
      const frame = mainFrameRef.current;
      const initial = optionsRef.current;
      if (!frame || frame.nextCueIndex >= frame.plan.cues.length) {
        mainFrameRef.current = null;
        setProgress(null);
        setStatus("idle");
        return;
      }
      if (!initial.active || !initial.agentId || !initial.teacherSession) {
        setStatus("unavailable");
        return;
      }

      const { controller, generation } = beginExecution(
        "resume",
        true,
        "main",
      );
      try {
        if (announceReturn) {
          setStatus("explaining");
          await speakAgent({
            agentId: initial.agentId,
            text: RETURN_PHRASE,
            priority: "INTERRUPT",
            interruptable: true,
          });
          await waitForSpeech(RETURN_PHRASE, controller.signal);
        }
        await executePlan(
          frame.plan,
          frame.nextCueIndex,
          "lesson",
          controller,
          generation,
          frame,
          !announceReturn,
        );
        if (generation === generationRef.current) {
          mainFrameRef.current = null;
          setProgress(null);
          setStatus("idle");
        }
      } catch (error) {
        handleExecutionError(error, generation);
      } finally {
        finishExecution(controller, generation);
      }
    },
    [
      beginExecution,
      executePlan,
      finishExecution,
      handleExecutionError,
      waitForSpeech,
    ],
  );

  const runClarification = useCallback(
    async (question: string, fromVoice: boolean): Promise<void> => {
      const frame = mainFrameRef.current;
      const initial = optionsRef.current;
      if (!frame) {
        await runNewLesson(question, fromVoice);
        return;
      }
      if (!initial.active || !initial.agentId || !initial.teacherSession) {
        setStatus("unavailable");
        return;
      }

      const { controller, generation } = beginExecution(
        "clarify",
        true,
        "clarification",
      );
      try {
        setProgress(null);
        setStatus("planning");
        const clarification = await requestLessonPlan(
          question,
          "clarification",
          optionsRef.current,
          controller.signal,
          frame.plan.topic,
        );
        await executePlan(
          clarification,
          0,
          "clarification",
          controller,
          generation,
        );

        if (
          controller.signal.aborted ||
          generation !== generationRef.current ||
          mainFrameRef.current !== frame
        ) {
          throw new DOMException("Aborted", "AbortError");
        }

        setStatus("explaining");
        await speakAgent({
          agentId: initial.agentId,
          text: RETURN_PHRASE,
          priority: "APPEND",
          interruptable: true,
        });
        await waitForSpeech(RETURN_PHRASE, controller.signal);
        activeKindRef.current = "main";
        await executePlan(
          frame.plan,
          frame.nextCueIndex,
          "lesson",
          controller,
          generation,
          frame,
          false,
        );
        if (generation === generationRef.current) {
          mainFrameRef.current = null;
          setProgress(null);
          setStatus("idle");
        }
      } catch (error) {
        handleExecutionError(error, generation);
      } finally {
        finishExecution(controller, generation);
      }
    },
    [
      beginExecution,
      executePlan,
      finishExecution,
      handleExecutionError,
      runNewLesson,
      waitForSpeech,
    ],
  );

  const handleLogicalTurn = useCallback(
    async (rawText: string, fromVoice: boolean): Promise<void> => {
      const question = rawText.trim();
      const normalized = normalizeLearnerText(question);
      if (!normalized) return;

      if (isClearBoardIntent(question)) {
        await clearCurrentLesson();
        return;
      }
      if (
        isStopIntent(question) &&
        !isExplicitTopicReplacement(question)
      ) {
        await pauseCurrentLesson();
        return;
      }

      const now = Date.now();
      recentLogicalTurnsRef.current = recentLogicalTurnsRef.current.filter(
        (item) => now - item.at <= LOGICAL_DUPLICATE_WINDOW_MS,
      );
      const duplicate = recentLogicalTurnsRef.current.some((item) =>
        areEquivalentTurns(item.text, normalized),
      );
      console.info("[teacher-director] logical turn", {
        fingerprint: turnFingerprint(normalized),
        source: fromVoice ? "voice" : "typed",
        duplicate,
      });
      if (duplicate) return;
      recentLogicalTurnsRef.current.push({ text: normalized, at: now });

      if (isResumeIntent(question) && mainFrameRef.current) {
        if (activeKindRef.current === "main" && abortRef.current) return;
        await resumeMainLesson(false);
        return;
      }

      if (mainFrameRef.current && !isExplicitTopicReplacement(question)) {
        await runClarification(question, fromVoice);
        return;
      }
      await runNewLesson(question, fromVoice);
    },
    [
      clearCurrentLesson,
      pauseCurrentLesson,
      resumeMainLesson,
      runClarification,
      runNewLesson,
    ],
  );

  const sendTeacherQuestion = useCallback(
    (text: string) => handleLogicalTurn(text, false),
    [handleLogicalTurn],
  );

  useEffect(() => {
    if (!options.active || !abortRef.current) return;
    const localId = String(options.localUID ?? "");
    const learnerStartedSpeaking = options.transcriptItems.some((item) => {
      if (
        !localId ||
        item.uid !== localId ||
        item.status !== ETurnStatus.IN_PROGRESS ||
        !item.text.trim()
      ) {
        return false;
      }
      const physicalKey = `${item.stream_id}:${item.turn_id}`;
      if (seenVoiceActivityRef.current.has(physicalKey)) return false;
      seenVoiceActivityRef.current.add(physicalKey);
      return true;
    });
    if (!learnerStartedSpeaking) return;
    cancelActiveExecution("clarify", true);
    setStatus("interrupted");
  }, [
    cancelActiveExecution,
    options.active,
    options.localUID,
    options.transcriptItems,
  ]);

  useEffect(() => {
    const localId = String(options.localUID ?? "");
    if (!options.active) {
      for (const item of options.transcriptItems) {
        if (localId && item.uid === localId) {
          const physicalKey = `${item.stream_id}:${item.turn_id}`;
          seenVoiceTurnsRef.current.add(physicalKey);
          seenVoiceActivityRef.current.add(physicalKey);
        }
      }
      return;
    }
    const candidates = options.transcriptItems
      .filter((item) => {
        if (
          !localId ||
          item.uid !== localId ||
          item.status !== ETurnStatus.END ||
          !item.text.trim()
        ) {
          return false;
        }
        const physicalKey = `${item.stream_id}:${item.turn_id}`;
        if (seenVoiceTurnsRef.current.has(physicalKey)) return false;
        seenVoiceTurnsRef.current.add(physicalKey);
        return true;
      })
      .sort((left, right) => left._time - right._time);

    if (candidates.length === 0) return;
    const newest = candidates[candidates.length - 1];
    const normalized = normalizeLearnerText(newest.text);
    pendingVoiceRef.current = {
      text: newest.text,
      fingerprint: turnFingerprint(normalized),
    };
    if (voiceTimerRef.current !== null) {
      window.clearTimeout(voiceTimerRef.current);
    }
    voiceTimerRef.current = window.setTimeout(() => {
      voiceTimerRef.current = null;
      const pending = pendingVoiceRef.current;
      pendingVoiceRef.current = null;
      if (!pending || !optionsRef.current.active) return;
      console.info("[teacher-director] voice turn stabilized", {
        fingerprint: pending.fingerprint,
      });
      void handleLogicalTurn(pending.text, true);
    }, VOICE_COALESCE_MS);
  }, [
    handleLogicalTurn,
    options.active,
    options.localUID,
    options.transcriptItems,
  ]);

  useEffect(() => {
    if (options.active && options.agentId && options.teacherSession) return;
    cancelLesson();
    setStatus(options.active ? "unavailable" : "idle");
  }, [
    cancelLesson,
    options.active,
    options.agentId,
    options.teacherSession,
  ]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (voiceTimerRef.current !== null) {
        window.clearTimeout(voiceTimerRef.current);
      }
    },
    [],
  );

  return { status, progress, sendTeacherQuestion, cancelLesson };
}
