import type {
  TeacherColor,
  TeacherDrawRequest,
  TeacherElementPatch,
  TeacherOperation,
  TeacherPoint,
} from "@/types/teacher";

type ParseTeacherDrawResult =
  | { ok: true; value: TeacherDrawRequest }
  | { ok: false; error: string };

const COLORS = new Set<TeacherColor>([
  "white",
  "cyan",
  "blue",
  "green",
  "amber",
  "red",
]);
const UNSAFE_TEXT = /<[^>]+>|https?:\/\/|data:|javascript:/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function finiteNumber(
  value: unknown,
  minimum = -10_000,
  maximum = 10_000,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function identifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 80 &&
    /^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(value)
  );
}

function boundedText(value: unknown, optional = false): value is string | undefined {
  if (optional && value === undefined) return true;
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 500 &&
    !UNSAFE_TEXT.test(value)
  );
}

function color(value: unknown): value is TeacherColor | undefined {
  return value === undefined || (typeof value === "string" && COLORS.has(value as TeacherColor));
}

function point(value: unknown): value is TeacherPoint {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["x", "y"]) &&
    finiteNumber(value.x) &&
    finiteNumber(value.y)
  );
}

function parsePatch(value: unknown): TeacherElementPatch | null {
  if (!isRecord(value)) return null;
  if (
    !hasOnlyKeys(value, [
      "x",
      "y",
      "width",
      "height",
      "color",
      "text",
      "label",
      "font_size",
    ])
  ) {
    return null;
  }

  const patch: TeacherElementPatch = {};
  if (value.x !== undefined && !finiteNumber(value.x)) return null;
  if (value.y !== undefined && !finiteNumber(value.y)) return null;
  if (value.width !== undefined && !finiteNumber(value.width, 1, 4_000)) return null;
  if (value.height !== undefined && !finiteNumber(value.height, 1, 4_000)) return null;
  if (!color(value.color)) return null;
  if (!boundedText(value.text, true) || !boundedText(value.label, true)) return null;
  if (value.font_size !== undefined && !finiteNumber(value.font_size, 12, 72)) return null;

  if (typeof value.x === "number") patch.x = value.x;
  if (typeof value.y === "number") patch.y = value.y;
  if (typeof value.width === "number") patch.width = value.width;
  if (typeof value.height === "number") patch.height = value.height;
  if (typeof value.color === "string") patch.color = value.color as TeacherColor;
  if (typeof value.text === "string") patch.text = value.text;
  if (typeof value.label === "string") patch.label = value.label;
  if (typeof value.font_size === "number") patch.fontSize = value.font_size;
  return Object.keys(patch).length > 0 ? patch : null;
}

function parseOperation(value: unknown): TeacherOperation | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;

  if (value.type === "clear_ai_elements" || value.type === "clear_board") {
    return hasOnlyKeys(value, ["type"]) ? { type: value.type } : null;
  }

  if (value.type === "delete_element") {
    return hasOnlyKeys(value, ["type", "element_id"]) && identifier(value.element_id)
      ? { type: value.type, elementId: value.element_id }
      : null;
  }

  if (value.type === "focus_area") {
    return hasOnlyKeys(value, ["type", "x", "y", "width", "height"]) &&
      finiteNumber(value.x) &&
      finiteNumber(value.y) &&
      finiteNumber(value.width, 1, 4_000) &&
      finiteNumber(value.height, 1, 4_000)
      ? {
          type: value.type,
          x: value.x,
          y: value.y,
          width: value.width,
          height: value.height,
        }
      : null;
  }

  if (value.type === "update_element") {
    const parsedPatch = parsePatch(value.patch);
    return hasOnlyKeys(value, ["type", "element_id", "patch"]) &&
      identifier(value.element_id) &&
      parsedPatch
      ? { type: value.type, elementId: value.element_id, patch: parsedPatch }
      : null;
  }

  if (value.type === "add_text") {
    return hasOnlyKeys(value, [
      "type",
      "element_id",
      "x",
      "y",
      "text",
      "color",
      "font_size",
    ]) &&
      identifier(value.element_id) &&
      finiteNumber(value.x) &&
      finiteNumber(value.y) &&
      boundedText(value.text) &&
      color(value.color) &&
      (value.font_size === undefined || finiteNumber(value.font_size, 12, 72))
      ? {
          type: value.type,
          elementId: value.element_id,
          x: value.x,
          y: value.y,
          text: value.text as string,
          ...(typeof value.color === "string" && { color: value.color as TeacherColor }),
          ...(typeof value.font_size === "number" && { fontSize: value.font_size }),
        }
      : null;
  }

  if (
    value.type === "add_rectangle" ||
    value.type === "add_ellipse" ||
    value.type === "add_diamond"
  ) {
    return hasOnlyKeys(value, [
      "type",
      "element_id",
      "x",
      "y",
      "width",
      "height",
      "color",
      "label",
    ]) &&
      identifier(value.element_id) &&
      finiteNumber(value.x) &&
      finiteNumber(value.y) &&
      finiteNumber(value.width, 1, 4_000) &&
      finiteNumber(value.height, 1, 4_000) &&
      color(value.color) &&
      boundedText(value.label, true)
      ? {
          type: value.type,
          elementId: value.element_id,
          x: value.x,
          y: value.y,
          width: value.width,
          height: value.height,
          ...(typeof value.color === "string" && { color: value.color as TeacherColor }),
          ...(typeof value.label === "string" && { label: value.label }),
        }
      : null;
  }

  if (value.type === "add_arrow" || value.type === "add_line") {
    return hasOnlyKeys(value, [
      "type",
      "element_id",
      "start",
      "end",
      "color",
      "label",
    ]) &&
      identifier(value.element_id) &&
      point(value.start) &&
      point(value.end) &&
      color(value.color) &&
      boundedText(value.label, true)
      ? {
          type: value.type,
          elementId: value.element_id,
          start: value.start,
          end: value.end,
          ...(typeof value.color === "string" && { color: value.color as TeacherColor }),
          ...(typeof value.label === "string" && { label: value.label }),
        }
      : null;
  }

  return null;
}

function toWirePatch(patch: TeacherElementPatch): Record<string, unknown> {
  return {
    ...(patch.x !== undefined && { x: patch.x }),
    ...(patch.y !== undefined && { y: patch.y }),
    ...(patch.width !== undefined && { width: patch.width }),
    ...(patch.height !== undefined && { height: patch.height }),
    ...(patch.color !== undefined && { color: patch.color }),
    ...(patch.text !== undefined && { text: patch.text }),
    ...(patch.label !== undefined && { label: patch.label }),
    ...(patch.fontSize !== undefined && { font_size: patch.fontSize }),
  };
}

function toWireOperation(operation: TeacherOperation): Record<string, unknown> {
  switch (operation.type) {
    case "add_text":
      return {
        type: operation.type,
        element_id: operation.elementId,
        x: operation.x,
        y: operation.y,
        text: operation.text,
        ...(operation.color !== undefined && { color: operation.color }),
        ...(operation.fontSize !== undefined && { font_size: operation.fontSize }),
      };
    case "add_rectangle":
    case "add_ellipse":
    case "add_diamond":
      return {
        type: operation.type,
        element_id: operation.elementId,
        x: operation.x,
        y: operation.y,
        width: operation.width,
        height: operation.height,
        ...(operation.color !== undefined && { color: operation.color }),
        ...(operation.label !== undefined && { label: operation.label }),
      };
    case "add_arrow":
    case "add_line":
      return {
        type: operation.type,
        element_id: operation.elementId,
        start: operation.start,
        end: operation.end,
        ...(operation.color !== undefined && { color: operation.color }),
        ...(operation.label !== undefined && { label: operation.label }),
      };
    case "update_element":
      return {
        type: operation.type,
        element_id: operation.elementId,
        patch: toWirePatch(operation.patch),
      };
    case "delete_element":
      return { type: operation.type, element_id: operation.elementId };
    case "clear_ai_elements":
    case "clear_board":
      return { type: operation.type };
    case "focus_area":
      return {
        type: operation.type,
        x: operation.x,
        y: operation.y,
        width: operation.width,
        height: operation.height,
      };
    default: {
      const exhaustive: never = operation;
      return exhaustive;
    }
  }
}

export function toTeacherDrawWireRequest(
  request: TeacherDrawRequest,
): Record<string, unknown> {
  return {
    turn_id: request.turnId,
    sequence: request.sequence,
    animation: request.animation,
    operations: request.operations.map(toWireOperation),
  };
}

export function parseTeacherDrawRequest(value: unknown): ParseTeacherDrawResult {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["turn_id", "sequence", "animation", "operations"]) ||
    !identifier(value.turn_id) ||
    !Number.isSafeInteger(value.sequence) ||
    (value.sequence as number) < 0 ||
    (value.animation !== undefined &&
      value.animation !== "progressive" &&
      value.animation !== "instant") ||
    !Array.isArray(value.operations) ||
    value.operations.length < 1 ||
    value.operations.length > 24
  ) {
    return { ok: false, error: "Invalid teacher_draw request envelope." };
  }

  const operations: TeacherOperation[] = [];
  for (const operation of value.operations) {
    const parsed = parseOperation(operation);
    if (!parsed) {
      return { ok: false, error: "The teacher_draw request contains an invalid operation." };
    }
    operations.push(parsed);
  }

  return {
    ok: true,
    value: {
      turnId: value.turn_id,
      sequence: value.sequence as number,
      animation: value.animation === "instant" ? "instant" : "progressive",
      operations,
    },
  };
}
