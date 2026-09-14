import {
  FONT_FAMILY,
  convertToExcalidrawElements,
} from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
  TeacherBoardState,
  TeacherColor,
  TeacherSceneElement,
} from "@/types/teacher";

const BOARD_COLORS: Record<TeacherColor, string> = {
  // Excalidraw's dark canvas inverts luminance while retaining hue, so these
  // dark source colors render as bright chalk strokes.
  white: "#020617",
  cyan: "#164e63",
  blue: "#1e3a8a",
  green: "#14532d",
  amber: "#78350f",
  red: "#7f1d1d",
};

function stableNumber(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) || 1;
}

function commonSkeleton(element: TeacherSceneElement) {
  return {
    id: element.id,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    strokeColor: BOARD_COLORS[element.color],
    backgroundColor: "transparent",
    fillStyle: "hachure" as const,
    strokeWidth: 2,
    strokeStyle: "solid" as const,
    roughness: 2,
    opacity: 100,
    seed: stableNumber(element.id),
    version: element.version,
    versionNonce: stableNumber(`${element.id}:${element.version}`),
    customData: {
      teacherOwner: element.owner,
      teacherElementId: element.id,
    },
  };
}

function labelSkeleton(element: TeacherSceneElement) {
  if (!element.label) return undefined;
  return {
    id: `${element.id}-label`,
    text: element.label,
    fontSize: 22,
    fontFamily: FONT_FAMILY.Virgil,
    strokeColor: BOARD_COLORS[element.color],
    customData: {
      teacherOwner: element.owner,
      teacherElementId: element.id,
    },
  };
}

function toSkeleton(element: TeacherSceneElement): ExcalidrawElementSkeleton {
  const common = commonSkeleton(element);
  if (element.kind === "text") {
    return {
      ...common,
      type: "text",
      text: element.text ?? "",
      fontSize: element.fontSize ?? 26,
      fontFamily: FONT_FAMILY.Virgil,
      textAlign: "left",
      verticalAlign: "top",
    } as ExcalidrawElementSkeleton;
  }

  if (element.kind === "arrow" || element.kind === "line") {
    return {
      ...common,
      type: element.kind,
      width: Math.abs(element.width),
      height: Math.abs(element.height),
      points: [
        [0, 0],
        [element.width, element.height],
      ],
      endArrowhead: element.kind === "arrow" ? "arrow" : null,
      startArrowhead: null,
      label: labelSkeleton(element),
    } as ExcalidrawElementSkeleton;
  }

  return {
    ...common,
    type: element.kind,
    roundness:
      element.kind === "rectangle" ? { type: 3, value: 18 } : undefined,
    label: labelSkeleton(element),
  } as ExcalidrawElementSkeleton;
}

export function toExcalidrawElements(
  state: TeacherBoardState,
): OrderedExcalidrawElement[] {
  const sceneElements = Object.values(state.elements);
  const sourceByOutputId = new Map<string, TeacherSceneElement>();
  for (const element of sceneElements) {
    sourceByOutputId.set(element.id, element);
    if (element.label) sourceByOutputId.set(`${element.id}-label`, element);
  }
  const converted = convertToExcalidrawElements(
    sceneElements.map(toSkeleton),
    { regenerateIds: false },
  );
  return converted.map((item) => {
    const source = sourceByOutputId.get(item.id);
    return {
      ...item,
      customData: {
        ...item.customData,
        teacherOwner: source?.owner ?? "ai",
        teacherElementId: source?.id ?? item.id,
      },
    } as OrderedExcalidrawElement;
  });
}

export function getFocusedExcalidrawElements(
  elements: readonly OrderedExcalidrawElement[],
  state: TeacherBoardState,
): readonly OrderedExcalidrawElement[] {
  const focus = state.focusArea;
  if (!focus) return elements;
  const right = focus.x + focus.width;
  const bottom = focus.y + focus.height;
  const focused = elements.filter((element) => {
    const elementRight = element.x + Math.abs(element.width);
    const elementBottom = element.y + Math.abs(element.height);
    return (
      elementRight >= focus.x &&
      element.x <= right &&
      elementBottom >= focus.y &&
      element.y <= bottom
    );
  });
  return focused.length > 0 ? focused : elements;
}
