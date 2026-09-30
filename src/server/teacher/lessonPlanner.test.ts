import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { planTeacherLesson } from "./lessonPlanner";

const validLesson = {
  topic: "Agent loop",
  cues: [
    {
      cue_id: "observe",
      speech: "An agent begins by observing its environment.",
      operations: [
        {
          type: "add_ellipse",
          element_id: "observe",
          x: 100,
          y: 220,
          width: 190,
          height: 110,
          label: "Observe",
        },
      ],
    },
    {
      cue_id: "reason",
      speech: "It reasons about the information it collected.",
      operations: [
        {
          type: "add_rectangle",
          element_id: "reason",
          x: 420,
          y: 220,
          width: 190,
          height: 110,
          label: "Reason",
        },
      ],
    },
    {
      cue_id: "connect",
      speech: "The observation flows into reasoning.",
      operations: [
        {
          type: "add_arrow",
          element_id: "observe-reason",
          start: { x: 290, y: 275 },
          end: { x: 420, y: 275 },
        },
      ],
    },
    {
      cue_id: "recap",
      speech: "The cycle repeats after the agent acts.",
      operations: [
        {
          type: "add_text",
          element_id: "recap",
          x: 100,
          y: 500,
          text: "Observe → Reason → Act → Feedback",
          font_size: 30,
        },
      ],
    },
  ],
};

describe("planTeacherLesson", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.TEACHER_DIRECTOR_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.TEACHER_DIRECTOR_API_KEY;
  });

  it("accepts a valid lesson response that takes 25 seconds", async () => {
    vi.spyOn(global, "fetch").mockImplementation((_url, options) => {
      const signal = options?.signal;
      return new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve(
            new Response(
              JSON.stringify({
                choices: [{ message: { content: JSON.stringify(validLesson) } }],
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            ),
          );
        }, 25_000);
        signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );
      });
    });

    const resultPromise = planTeacherLesson({
      turnId: "turn-1",
      question: "How does an AI agent loop work?",
      context: [],
      boardSummary: "",
      mode: "lesson",
    });
    const resultExpectation = expect(resultPromise).resolves.toMatchObject({
      topic: "Agent loop",
    });

    await vi.advanceTimersByTimeAsync(25_000);
    await resultExpectation;
  });

  it("repairs overlapping lesson text locally without a second planner request", async () => {
    const lessonWithOverlappingText = structuredClone(validLesson);
    lessonWithOverlappingText.cues[0].operations.push(
      {
        type: "add_text",
        element_id: "title",
        x: 100,
        y: 80,
        text: "How an AI agent works",
        font_size: 36,
      },
      {
        type: "add_text",
        element_id: "loop-caption",
        x: 120,
        y: 90,
        text: "A repeating decision cycle",
        font_size: 30,
      },
    );

    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify(lessonWithOverlappingText),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockRejectedValueOnce(new Error("Unexpected second planner request"));

    const result = await planTeacherLesson({
      turnId: "turn-overlap",
      question: "How does an AI agent work?",
      context: [],
      boardSummary: "",
      mode: "lesson",
    });

    const title = result.cues[0].boardActions.find(
      (operation) =>
        operation.type === "add_text" && operation.elementId === "title",
    );
    const caption = result.cues[0].boardActions.find(
      (operation) =>
        operation.type === "add_text" &&
        operation.elementId === "loop-caption",
    );

    expect(title).toMatchObject({ type: "add_text", y: 80, fontSize: 36 });
    expect(caption).toMatchObject({
      type: "add_text",
      y: 147,
      fontSize: 30,
    });
  });
});
