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
