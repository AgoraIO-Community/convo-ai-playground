import { describe, expect, it } from "vitest";
import {
  applyTeacherCommand,
  INITIAL_TEACHER_BOARD_STATE,
} from "./boardReducer";

describe("applyTeacherCommand", () => {
  it("uses a readable default size for generated blackboard text", () => {
    const state = applyTeacherCommand(INITIAL_TEACHER_BOARD_STATE, {
      eventId: 1,
      command: {
        turnId: "turn-1",
        sequence: 0,
        animation: "instant",
        operations: [
          {
            type: "add_text",
            elementId: "lesson-title",
            x: 100,
            y: 80,
            text: "Agent Loop",
          },
        ],
      },
    });

    expect(state.elements["lesson-title"].fontSize).toBe(30);
  });
});
