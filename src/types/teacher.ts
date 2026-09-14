export type TeacherColor =
  | "white"
  | "cyan"
  | "blue"
  | "green"
  | "amber"
  | "red";

export interface TeacherPoint {
  x: number;
  y: number;
}

export interface TeacherFocusArea extends TeacherPoint {
  width: number;
  height: number;
}

export interface TeacherElementPatch {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: TeacherColor;
  text?: string;
  label?: string;
  fontSize?: number;
}

export type TeacherOperation =
  | {
      type: "add_text";
      elementId: string;
      x: number;
      y: number;
      text: string;
      color?: TeacherColor;
      fontSize?: number;
    }
  | {
      type: "add_rectangle" | "add_ellipse" | "add_diamond";
      elementId: string;
      x: number;
      y: number;
      width: number;
      height: number;
      color?: TeacherColor;
      label?: string;
    }
  | {
      type: "add_arrow" | "add_line";
      elementId: string;
      start: TeacherPoint;
      end: TeacherPoint;
      color?: TeacherColor;
      label?: string;
    }
  | {
      type: "update_element";
      elementId: string;
      patch: TeacherElementPatch;
    }
  | { type: "delete_element"; elementId: string }
  | { type: "clear_ai_elements" }
  | { type: "clear_board" }
  | ({ type: "focus_area" } & TeacherFocusArea);

export interface TeacherDrawRequest {
  turnId: string;
  sequence: number;
  animation: "progressive" | "instant";
  operations: TeacherOperation[];
}

export interface TeacherLessonCue {
  cueId: string;
  speech: string;
  boardActions: TeacherOperation[];
}

export interface TeacherLessonPlan {
  turnId: string;
  topic: string;
  cues: TeacherLessonCue[];
}

export type TeacherLessonMode = "lesson" | "clarification";

export interface TeacherLessonProgress {
  current: number;
  total: number;
}

export interface TeacherLessonContextItem {
  role: "user" | "assistant";
  text: string;
}

export type TeacherLessonStatus =
  | "idle"
  | "planning"
  | "writing"
  | "explaining"
  | "clarifying"
  | "paused"
  | "interrupted"
  | "unavailable"
  | "error";

export type TeacherElementKind =
  | "text"
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "arrow"
  | "line";

export interface TeacherSceneElement {
  id: string;
  owner: "ai" | "student";
  kind: TeacherElementKind;
  x: number;
  y: number;
  width: number;
  height: number;
  color: TeacherColor;
  text?: string;
  label?: string;
  fontSize?: number;
  version: number;
}

export interface TeacherCommandEvent {
  eventId: number;
  command: TeacherDrawRequest;
}

export interface TeacherBoardState {
  elements: Record<string, TeacherSceneElement>;
  processedEventIds: number[];
  activeTurnId: string | null;
  lastSequence: number;
  interruptedTurnIds: string[];
  focusArea: TeacherFocusArea | null;
  revision: number;
  clearBoardRevision: number;
}

export interface TeacherSessionCredentials {
  sessionId: string;
  token: string;
  expiresAt: number;
  liveMcpConfigured: boolean;
}

export type TeacherStreamMessage =
  | { type: "command"; event: TeacherCommandEvent }
  | { type: "heartbeat"; sentAt: number };

export type TeacherConnectionState =
  | "connecting"
  | "live"
  | "offline"
  | "demo";
