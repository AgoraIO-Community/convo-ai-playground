import {
  assertTeacherLessonQuality,
  parseTeacherLessonPlan,
  TeacherLessonValidationError,
} from "@/lib/teacher/lessonSchema";
import type {
  TeacherLessonContextItem,
  TeacherLessonMode,
  TeacherLessonPlan,
} from "@/types/teacher";
import { AI_TEACHER_DEFAULT_MODEL } from "@/constants/aiTeacherDefaults";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = AI_TEACHER_DEFAULT_MODEL;
const PLANNER_TIMEOUT_MS = 20_000;

const SYSTEM_PROMPT = `You are the lesson planner for a live, interactive AI teacher with a dark Excalidraw blackboard.
Return only one JSON object with this exact shape:
{"topic":"Agent loop","cues":[{"cue_id":"title","speech":"An agent works in a repeating loop.","operations":[{"type":"add_text","element_id":"title","x":120,"y":70,"text":"Agent Loop","color":"white","font_size":36}]},{"cue_id":"observe","speech":"First it observes the environment.","operations":[{"type":"add_ellipse","element_id":"observe","x":140,"y":220,"width":190,"height":100,"color":"cyan","label":"Observe"}]},{"cue_id":"reason","speech":"Then it reasons about the next action.","operations":[{"type":"add_rectangle","element_id":"reason","x":470,"y":220,"width":190,"height":100,"color":"amber","label":"Reason"},{"type":"add_arrow","element_id":"observe-to-reason","start":{"x":330,"y":270},"end":{"x":470,"y":270},"color":"white"}]},{"cue_id":"act","speech":"It acts, sees the result, and repeats.","operations":[{"type":"add_diamond","element_id":"act","x":800,"y":210,"width":170,"height":120,"color":"green","label":"Act"},{"type":"add_arrow","element_id":"reason-to-act","start":{"x":660,"y":270},"end":{"x":800,"y":270},"color":"white"},{"type":"add_arrow","element_id":"feedback","start":{"x":885,"y":330},"end":{"x":235,"y":330},"color":"blue","label":"feedback"}]}]}

The user payload contains lesson_mode. For lesson_mode "lesson", create a complete 4 to 7 cue lesson that continues automatically from introduction through explanation and recap. For lesson_mode "clarification", create 1 to 4 focused cues that resolve the learner's confusion using the existing board and parent topic. Each cue must contain concise, accurate speech and 1 to 16 board operations that visibly support exactly what is being said in that cue. The board update happens immediately before its speech. Never ask the learner to say continue. Never say you will draw later and never mention tools, JSON, MCP, coordinates, turn IDs, or system behavior.

You can teach any topic without templates. Choose the best visual language for the concept: explanatory text, headings, equations, worked steps, short code, labeled shapes, timelines, lists, or connected diagrams. In full lesson mode, always create a meaningful visual structure with at least two labeled shapes and one arrow or line, even for worked examples where the shapes may group steps. Do not return a title-only or text-only lesson. Build understanding incrementally like a strong online teacher: introduce, develop, connect, give a concrete example, and recap. Use readable spacing within a primary canvas around x=80..1100 and y=70..700. Prefer font sizes 22..38. Keep labels short. Reuse stable element IDs when updating. Do not overlap unrelated content. Do not clear existing board content during a clarification.

Allowed operations and fields only:
- add_text: type, element_id, x, y, text, optional color, optional font_size
- add_rectangle/add_ellipse/add_diamond: type, element_id, x, y, width, height, optional color, optional label
- add_arrow/add_line: type, element_id, start:{x,y}, end:{x,y}, optional color, optional label
- update_element: type, element_id, patch containing one or more of x,y,width,height,color,text,label,font_size
- delete_element: type, element_id
- clear_ai_elements or clear_board: type only
- focus_area: type, x, y, width, height

Allowed colors: white, cyan, blue, green, amber, red. IDs use letters, numbers, dot, underscore, colon, or hyphen and are at most 80 characters. Board text is at most 500 characters. Each spoken cue must be at most 450 UTF-8 bytes. Use at most 64 operations across the lesson. Do not output markdown fences or properties outside the required shape.`;

export interface PlanTeacherLessonInput {
  turnId: string;
  question: string;
  context: TeacherLessonContextItem[];
  boardSummary: string;
  mode: TeacherLessonMode;
  parentTopic?: string;
}

export class TeacherPlannerUnavailableError extends Error {
  constructor() {
    super("Teacher lesson planning is not configured.");
    this.name = "TeacherPlannerUnavailableError";
  }
}

export class TeacherPlannerUpstreamError extends Error {
  readonly upstreamStatus: number | null;

  constructor(message: string, upstreamStatus: number | null = null) {
    super(message);
    this.name = "TeacherPlannerUpstreamError";
    this.upstreamStatus = upstreamStatus;
  }
}

function getPlannerApiKey(): string {
  return (
    process.env.TEACHER_DIRECTOR_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.LLM_API_KEY?.trim() ||
    ""
  );
}

function getPlannerModel(): string {
  return process.env.TEACHER_DIRECTOR_MODEL?.trim() || DEFAULT_MODEL;
}

function createTimeoutSignal(parentSignal?: AbortSignal): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PLANNER_TIMEOUT_MS);
  const abortFromParent = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) {
    abortFromParent();
  } else {
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", abortFromParent);
    },
  };
}

function extractContent(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0];
  if (typeof first !== "object" || first === null) return null;
  const message = (first as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content : null;
}

async function requestPlanContent(
  input: PlanTeacherLessonInput,
  apiKey: string,
  signal: AbortSignal,
  repairFeedback?: string,
): Promise<string> {
  const response = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getPlannerModel(),
      max_completion_tokens: 6000,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            lesson_mode: input.mode,
            learner_question: input.question,
            parent_topic: input.parentTopic,
            recent_conversation: input.context,
            current_board: input.boardSummary || "The board is empty.",
            ...(repairFeedback && {
              repair_required: repairFeedback,
              repair_instruction:
                "Return a complete replacement plan that satisfies every visual and cue requirement.",
            }),
          }),
        },
      ],
    }),
    signal,
  });

  const responseBody = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new TeacherPlannerUpstreamError(
      "Lesson planner request failed.",
      response.status,
    );
  }
  const content = extractContent(responseBody);
  if (!content) {
    throw new TeacherPlannerUpstreamError(
      "Lesson planner returned no usable content.",
      response.status,
    );
  }
  return content;
}

function parsePlanContent(
  content: string,
  input: PlanTeacherLessonInput,
): TeacherLessonPlan {
  let planWire: unknown;
  try {
    planWire = JSON.parse(content);
  } catch {
    throw new TeacherLessonValidationError(
      "Lesson planner returned invalid JSON.",
    );
  }
  const plan = parseTeacherLessonPlan(planWire, input.turnId);
  assertTeacherLessonQuality(plan, input.mode);
  return plan;
}

export async function planTeacherLesson(
  input: PlanTeacherLessonInput,
  parentSignal?: AbortSignal,
): Promise<TeacherLessonPlan> {
  const apiKey = getPlannerApiKey();
  if (!apiKey) throw new TeacherPlannerUnavailableError();

  const timeout = createTimeoutSignal(parentSignal);
  try {
    let repaired = false;
    let plan: TeacherLessonPlan;
    try {
      const content = await requestPlanContent(
        input,
        apiKey,
        timeout.signal,
      );
      plan = parsePlanContent(content, input);
    } catch (error) {
      if (!(error instanceof TeacherLessonValidationError)) throw error;
      repaired = true;
      const repairedContent = await requestPlanContent(
        input,
        apiKey,
        timeout.signal,
        error.message,
      );
      plan = parsePlanContent(repairedContent, input);
    }
    const stats = assertTeacherLessonQuality(plan, input.mode);
    console.info("[teacher-director] lesson plan ready", {
      mode: input.mode,
      repaired,
      cueCount: stats.cueCount,
      totalOperations: stats.totalOperations,
      operationTypes: stats.operationTypes,
    });
    return plan;
  } catch (error) {
    if (
      error instanceof TeacherPlannerUnavailableError ||
      error instanceof TeacherPlannerUpstreamError ||
      error instanceof TeacherLessonValidationError
    ) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new TeacherPlannerUpstreamError("Lesson planner request timed out.");
    }
    throw error;
  } finally {
    timeout.cleanup();
  }
}
