import { describe, expect, it } from "vitest";
import {
  assertTeacherLessonQuality,
  parseTeacherLessonPlan,
} from "./lessonSchema";

function planWithTextOperations(
  textOperations: Array<Record<string, unknown>>,
) {
  return parseTeacherLessonPlan(
    {
      topic: "Agent loop",
      cues: [
        {
          cue_id: "intro",
          speech: "An agent begins by observing its environment.",
          operations: [
            {
              type: "add_ellipse",
              element_id: "observe",
              x: 100,
              y: 240,
              width: 190,
              height: 110,
              label: "Observe",
            },
            ...textOperations,
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
              y: 240,
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
              start: { x: 290, y: 295 },
              end: { x: 420, y: 295 },
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
              y: 560,
              text: "Observe → Reason → Act → Feedback",
              font_size: 30,
            },
          ],
        },
      ],
    },
    "turn-1",
  );
}

describe("assertTeacherLessonQuality", () => {
  it("rejects standalone text that overlaps another text block", () => {
    const plan = planWithTextOperations([
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
        element_id: "subtitle",
        x: 180,
        y: 90,
        text: "A repeating decision cycle",
        font_size: 30,
      },
    ]);

    expect(() => assertTeacherLessonQuality(plan, "lesson")).toThrow(
      /overlap/i,
    );
  });

  it("rejects lesson text that is too small to read", () => {
    const plan = planWithTextOperations([
      {
        type: "add_text",
        element_id: "tiny-note",
        x: 100,
        y: 80,
        text: "Important detail",
        font_size: 22,
      },
    ]);

    expect(() => assertTeacherLessonQuality(plan, "lesson")).toThrow(
      /font size/i,
    );
  });

  it("allows a related annotation close to a shape", () => {
    const plan = planWithTextOperations([
      {
        type: "add_text",
        element_id: "observe-note",
        x: 100,
        y: 365,
        text: "Collects the latest signals",
        font_size: 30,
      },
    ]);

    expect(() => assertTeacherLessonQuality(plan, "lesson")).not.toThrow();
  });
});
