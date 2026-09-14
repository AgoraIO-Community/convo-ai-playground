import type {
  TeacherBoardState,
  TeacherCommandEvent,
  TeacherOperation,
  TeacherSceneElement,
} from "@/types/teacher";

const EVENT_HISTORY_LIMIT = 512;
const INTERRUPTED_TURN_LIMIT = 64;

export const INITIAL_TEACHER_BOARD_STATE: TeacherBoardState = {
  elements: {},
  processedEventIds: [],
  activeTurnId: null,
  lastSequence: -1,
  interruptedTurnIds: [],
  focusArea: null,
  revision: 0,
  clearBoardRevision: 0,
};

function nextVersion(existing: TeacherSceneElement | undefined): number {
  return existing?.owner === "ai" ? existing.version + 1 : 1;
}

function toSceneElement(
  operation: Extract<
    TeacherOperation,
    | { type: "add_text" }
    | { type: "add_rectangle" | "add_ellipse" | "add_diamond" }
    | { type: "add_arrow" | "add_line" }
  >,
  existing: TeacherSceneElement | undefined,
): TeacherSceneElement {
  if (operation.type === "add_text") {
    const fontSize = operation.fontSize ?? 26;
    return {
      id: operation.elementId,
      owner: "ai",
      kind: "text",
      x: operation.x,
      y: operation.y,
      width: Math.max(80, operation.text.length * fontSize * 0.58),
      height: fontSize * 1.35,
      color: operation.color ?? "white",
      text: operation.text,
      fontSize,
      version: nextVersion(existing),
    };
  }

  if ("start" in operation) {
    return {
      id: operation.elementId,
      owner: "ai",
      kind: operation.type === "add_arrow" ? "arrow" : "line",
      x: operation.start.x,
      y: operation.start.y,
      width: operation.end.x - operation.start.x,
      height: operation.end.y - operation.start.y,
      color: operation.color ?? "white",
      label: operation.label,
      version: nextVersion(existing),
    };
  }

  return {
    id: operation.elementId,
    owner: "ai",
    kind:
      operation.type === "add_rectangle"
        ? "rectangle"
        : operation.type === "add_ellipse"
          ? "ellipse"
          : "diamond",
    x: operation.x,
    y: operation.y,
    width: operation.width,
    height: operation.height,
    color: operation.color ?? "white",
    label: operation.label,
    version: nextVersion(existing),
  };
}

function applyOperation(
  elements: Record<string, TeacherSceneElement>,
  operation: TeacherOperation,
): {
  elements: Record<string, TeacherSceneElement>;
  focusArea?: TeacherBoardState["focusArea"];
  clearedBoard?: boolean;
  changed: boolean;
} {
  if (operation.type === "focus_area") {
    return {
      elements,
      focusArea: {
        x: operation.x,
        y: operation.y,
        width: operation.width,
        height: operation.height,
      },
      changed: true,
    };
  }

  if (operation.type === "clear_board") {
    return { elements: {}, clearedBoard: true, changed: true };
  }

  if (operation.type === "clear_ai_elements") {
    const remaining = Object.fromEntries(
      Object.entries(elements).filter(([, element]) => element.owner !== "ai"),
    );
    return { elements: remaining, changed: Object.keys(remaining).length !== Object.keys(elements).length };
  }

  if (operation.type === "delete_element") {
    const existing = elements[operation.elementId];
    if (!existing || existing.owner !== "ai") return { elements, changed: false };
    const next = { ...elements };
    delete next[operation.elementId];
    return { elements: next, changed: true };
  }

  if (operation.type === "update_element") {
    const existing = elements[operation.elementId];
    if (!existing || existing.owner !== "ai") return { elements, changed: false };
    return {
      elements: {
        ...elements,
        [operation.elementId]: {
          ...existing,
          ...operation.patch,
          id: existing.id,
          owner: "ai",
          kind: existing.kind,
          version: existing.version + 1,
        },
      },
      changed: true,
    };
  }

  const existing = elements[operation.elementId];
  if (existing?.owner === "student") return { elements, changed: false };
  return {
    elements: {
      ...elements,
      [operation.elementId]: toSceneElement(operation, existing),
    },
    changed: true,
  };
}

export function applyTeacherCommand(
  state: TeacherBoardState,
  event: TeacherCommandEvent,
): TeacherBoardState {
  const { command } = event;
  if (
    state.processedEventIds.includes(event.eventId) ||
    state.interruptedTurnIds.includes(command.turnId) ||
    (state.activeTurnId === command.turnId && command.sequence <= state.lastSequence)
  ) {
    return state;
  }

  let elements = state.elements;
  let focusArea = state.focusArea;
  let clearBoardRevision = state.clearBoardRevision;
  let changed = false;

  for (const operation of command.operations) {
    const result = applyOperation(elements, operation);
    elements = result.elements;
    if (result.focusArea !== undefined) focusArea = result.focusArea;
    if (result.clearedBoard) clearBoardRevision += 1;
    changed = result.changed || changed;
  }

  return {
    ...state,
    elements,
    focusArea,
    clearBoardRevision,
    activeTurnId: command.turnId,
    lastSequence: command.sequence,
    processedEventIds: [...state.processedEventIds, event.eventId].slice(
      -EVENT_HISTORY_LIMIT,
    ),
    revision: changed ? state.revision + 1 : state.revision,
  };
}

export function interruptTeacherTurn(
  state: TeacherBoardState,
): TeacherBoardState {
  if (!state.activeTurnId) return state;
  return {
    ...state,
    interruptedTurnIds: [
      ...state.interruptedTurnIds.filter((id) => id !== state.activeTurnId),
      state.activeTurnId,
    ].slice(-INTERRUPTED_TURN_LIMIT),
    activeTurnId: null,
    lastSequence: -1,
  };
}

export function clearTeacherBoard(state: TeacherBoardState): TeacherBoardState {
  return {
    ...INITIAL_TEACHER_BOARD_STATE,
    clearBoardRevision: state.clearBoardRevision + 1,
    revision: state.revision + 1,
  };
}
