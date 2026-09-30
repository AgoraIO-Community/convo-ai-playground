import { z } from "zod";
import { parseTeacherDrawRequest } from "@/lib/teacher/commands";
import type {
  TeacherLessonCue,
  TeacherLessonMode,
  TeacherLessonPlan,
} from "@/types/teacher";

const MAX_CUES = 10;
const MAX_OPERATIONS_PER_CUE = 16;
const MAX_TOTAL_OPERATIONS = 64;
const MAX_SPEECH_BYTES = 450;
const MIN_LESSON_FONT_SIZE = 28;
const DEFAULT_LESSON_FONT_SIZE = 30;
const ELEMENT_GAP = 18;

const lessonWireSchema = z
  .object({
    topic: z.string().trim().min(1).max(200),
    cues: z
      .array(
        z
          .object({
            cue_id: z
              .string()
              .trim()
              .min(1)
              .max(80)
              .regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/),
            speech: z.string().trim().min(1),
            operations: z.array(z.unknown()).min(1).max(MAX_OPERATIONS_PER_CUE),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_CUES),
  })
  .strict();

export class TeacherLessonValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeacherLessonValidationError";
  }
}

export interface TeacherLessonPlanStats {
  cueCount: number;
  totalOperations: number;
  visibleOperations: number;
  shapeOperations: number;
  connectorOperations: number;
  textOperations: number;
  operationTypes: Record<string, number>;
}

interface VisualBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function textBounds(
  id: string,
  x: number,
  y: number,
  text: string,
  fontSize: number,
): VisualBounds {
  const lines = text.split("\n");
  const longestLine = Math.max(...lines.map((line) => line.length), 1);
  return {
    id,
    x,
    y,
    width: Math.max(80, longestLine * fontSize * 0.58),
    height: Math.max(fontSize * 1.35, lines.length * fontSize * 1.35),
  };
}

function overlaps(left: VisualBounds, right: VisualBounds): boolean {
  return (
    left.x < right.x + right.width + ELEMENT_GAP &&
    left.x + left.width + ELEMENT_GAP > right.x &&
    left.y < right.y + right.height + ELEMENT_GAP &&
    left.y + left.height + ELEMENT_GAP > right.y
  );
}

export function normalizeTeacherLessonLayout(
  plan: TeacherLessonPlan,
): TeacherLessonPlan {
  const bounds = new Map<string, VisualBounds>();

  return {
    ...plan,
    cues: plan.cues.map((cue) => ({
      ...cue,
      boardActions: cue.boardActions.map((operation) => {
        if (
          operation.type === "clear_board" ||
          operation.type === "clear_ai_elements"
        ) {
          bounds.clear();
          return operation;
        }
        if (operation.type === "delete_element") {
          bounds.delete(operation.elementId);
          return operation;
        }
        if (operation.type === "add_text") {
          const fontSize = Math.max(
            operation.fontSize ?? DEFAULT_LESSON_FONT_SIZE,
            MIN_LESSON_FONT_SIZE,
          );
          let candidate = textBounds(
            operation.elementId,
            operation.x,
            operation.y,
            operation.text,
            fontSize,
          );

          while (true) {
            const conflicts = [...bounds.values()].filter((placed) =>
              overlaps(candidate, placed),
            );
            if (conflicts.length === 0) break;
            candidate = {
              ...candidate,
              y: Math.ceil(
                Math.max(
                  ...conflicts.map(
                    (placed) => placed.y + placed.height + ELEMENT_GAP,
                  ),
                ),
              ),
            };
          }

          bounds.set(operation.elementId, candidate);
          return {
            ...operation,
            y: candidate.y,
            fontSize,
          };
        }
        if (operation.type === "update_element") {
          const current = bounds.get(operation.elementId);
          if (current) {
            bounds.set(operation.elementId, {
              ...current,
              x: operation.patch.x ?? current.x,
              y: operation.patch.y ?? current.y,
              width: operation.patch.width ?? current.width,
              height: operation.patch.height ?? current.height,
            });
          }
        }
        return operation;
      }),
    })),
  };
}

function assertReadableLayout(plan: TeacherLessonPlan): void {
  const bounds = new Map<string, VisualBounds>();

  for (const operation of plan.cues.flatMap((cue) => cue.boardActions)) {
    if (
      operation.type === "clear_board" ||
      operation.type === "clear_ai_elements"
    ) {
      bounds.clear();
      continue;
    }
    if (operation.type === "delete_element") {
      bounds.delete(operation.elementId);
      continue;
    }
    if (operation.type === "add_text") {
      const fontSize = operation.fontSize ?? DEFAULT_LESSON_FONT_SIZE;
      if (fontSize < MIN_LESSON_FONT_SIZE) {
        throw new TeacherLessonValidationError(
          `Text ${operation.elementId} uses font size ${fontSize}; lesson text must be at least ${MIN_LESSON_FONT_SIZE}.`,
        );
      }
      bounds.set(
        operation.elementId,
        textBounds(
          operation.elementId,
          operation.x,
          operation.y,
          operation.text,
          fontSize,
        ),
      );
      continue;
    }
    if (operation.type === "update_element") {
      const current = bounds.get(operation.elementId);
      if (!current) continue;
      bounds.set(operation.elementId, {
        ...current,
        x: operation.patch.x ?? current.x,
        y: operation.patch.y ?? current.y,
        width: operation.patch.width ?? current.width,
        height: operation.patch.height ?? current.height,
      });
    }
  }

  const visualBounds = [...bounds.values()];
  for (let leftIndex = 0; leftIndex < visualBounds.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < visualBounds.length;
      rightIndex += 1
    ) {
      const left = visualBounds[leftIndex];
      const right = visualBounds[rightIndex];
      if (overlaps(left, right)) {
        throw new TeacherLessonValidationError(
          `Board elements ${left.id} and ${right.id} overlap; repair the layout with clear spacing.`,
        );
      }
    }
  }
}

export function summarizeTeacherLessonPlan(
  plan: TeacherLessonPlan,
): TeacherLessonPlanStats {
  const operations = plan.cues.flatMap((cue) => cue.boardActions);
  const operationTypes: Record<string, number> = {};
  let visibleOperations = 0;
  let shapeOperations = 0;
  let connectorOperations = 0;
  let textOperations = 0;

  for (const operation of operations) {
    operationTypes[operation.type] = (operationTypes[operation.type] ?? 0) + 1;
    if (operation.type.startsWith("add_") || operation.type === "update_element") {
      visibleOperations += 1;
    }
    if (
      operation.type === "add_rectangle" ||
      operation.type === "add_ellipse" ||
      operation.type === "add_diamond"
    ) {
      shapeOperations += 1;
    }
    if (operation.type === "add_arrow" || operation.type === "add_line") {
      connectorOperations += 1;
    }
    if (operation.type === "add_text") textOperations += 1;
  }

  return {
    cueCount: plan.cues.length,
    totalOperations: operations.length,
    visibleOperations,
    shapeOperations,
    connectorOperations,
    textOperations,
    operationTypes,
  };
}

export function assertTeacherLessonQuality(
  plan: TeacherLessonPlan,
  mode: TeacherLessonMode,
): TeacherLessonPlanStats {
  const stats = summarizeTeacherLessonPlan(plan);
  assertReadableLayout(plan);
  if (mode === "clarification") {
    if (stats.cueCount > 4 || stats.visibleOperations < 1) {
      throw new TeacherLessonValidationError(
        "A clarification must contain one to four focused visual cues.",
      );
    }
    return stats;
  }

  if (stats.cueCount < 4 || stats.cueCount > 7) {
    throw new TeacherLessonValidationError(
      "A complete lesson must contain four to seven progressive cues.",
    );
  }
  if (
    stats.visibleOperations < 4 ||
    stats.shapeOperations < 2 ||
    stats.connectorOperations < 1
  ) {
    throw new TeacherLessonValidationError(
      "A complete lesson must include a connected visual explanation with at least two shapes and one connector.",
    );
  }
  return stats;
}

export function parseTeacherLessonPlan(
  value: unknown,
  turnId: string,
): TeacherLessonPlan {
  const parsed = lessonWireSchema.safeParse(value);
  if (!parsed.success) {
    throw new TeacherLessonValidationError("Invalid lesson plan envelope.");
  }

  const cueIds = new Set<string>();
  let totalOperations = 0;
  const cues: TeacherLessonCue[] = parsed.data.cues.map((cue, sequence) => {
    if (cueIds.has(cue.cue_id)) {
      throw new TeacherLessonValidationError("Lesson cue IDs must be unique.");
    }
    cueIds.add(cue.cue_id);

    if (new TextEncoder().encode(cue.speech).byteLength > MAX_SPEECH_BYTES) {
      throw new TeacherLessonValidationError(
        `Lesson cue ${cue.cue_id} exceeds the speech byte limit.`,
      );
    }

    totalOperations += cue.operations.length;
    if (totalOperations > MAX_TOTAL_OPERATIONS) {
      throw new TeacherLessonValidationError(
        "Lesson plan contains too many board operations.",
      );
    }

    const drawRequest = parseTeacherDrawRequest({
      turn_id: turnId,
      sequence,
      animation: "instant",
      operations: cue.operations,
    });
    if (!drawRequest.ok) {
      throw new TeacherLessonValidationError(
        `Lesson cue ${cue.cue_id}: ${drawRequest.error}`,
      );
    }

    return {
      cueId: cue.cue_id,
      speech: cue.speech,
      boardActions: drawRequest.value.operations,
    };
  });

  return {
    turnId,
    topic: parsed.data.topic,
    cues,
  };
}
