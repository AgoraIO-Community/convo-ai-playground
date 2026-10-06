import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { INITIAL_TEACHER_BOARD_STATE } from "@/lib/teacher/boardReducer";
import { EAgentState } from "@/types/agora";
import type { UseTeacherBoardSessionResult } from "@/hooks/useTeacherBoardSession";

vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="teacher-board" />,
}));

vi.mock("@/components/teacher/TeacherAvatarPiP", () => ({
  default: () => <div data-testid="teacher-avatar" />,
}));

import TeacherStage from "./TeacherStage";

function createTeacher(): UseTeacherBoardSessionResult {
  return {
    boardState: INITIAL_TEACHER_BOARD_STATE,
    activeAnimation: "instant",
    connection: "demo",
    session: null,
    playDemo: vi.fn().mockResolvedValue(undefined),
    pauseDemo: vi.fn(),
    clearBoard: vi.fn(),
  } as unknown as UseTeacherBoardSessionResult;
}

describe("TeacherStage", () => {
  it("uses a landscape frame for the landing-page teacher preview", () => {
    render(
      <TeacherStage
        active
        teacher={createTeacher()}
        agentName="Samira"
        agentState={EAgentState.SPEAKING}
        transcriptionMode="rtm"
        variant="preview"
        previewAvatarImageSrc="/images/ai-teacher-samira-anam.png"
      />,
    );

    expect(
      screen.getByLabelText("AI teacher picture in picture"),
    ).toHaveClass("aspect-[3/2]");
  });

  it("keeps lesson actions outside the interactive whiteboard surface", () => {
    render(
      <TeacherStage
        active
        teacher={createTeacher()}
        agentName="Emma"
        agentState={EAgentState.LISTENING}
        transcriptionMode="rtm"
        variant="interactive"
        avatarPlacement="side"
      />,
    );

    const surface = screen.getByTestId("teacher-board-surface");
    const actions = screen.getByTestId("teacher-board-actions");

    expect(surface).not.toContainElement(actions);
  });
});
