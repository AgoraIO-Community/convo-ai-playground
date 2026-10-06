import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EAgentState } from "@/types/agora";
import TeacherAvatarPiP from "./TeacherAvatarPiP";

describe("TeacherAvatarPiP", () => {
  it("fills the landing preview without letterboxing the teacher image", () => {
    render(
      <TeacherAvatarPiP
        active
        agentName="Samira"
        agentState={EAgentState.SPEAKING}
        transcriptionMode="rtm"
        previewImageSrc="/images/ai-teacher-samira-anam.png"
      />,
    );

    expect(
      screen.getByRole("img", { name: "Samira AI teacher" }),
    ).toHaveClass("object-cover");
  });
});
