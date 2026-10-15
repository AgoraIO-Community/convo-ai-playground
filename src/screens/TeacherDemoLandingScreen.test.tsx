import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useTeacherBoardSession", () => ({
  useTeacherBoardSession: () => ({
    playDemo: vi.fn().mockResolvedValue(undefined),
    pauseDemo: vi.fn(),
  }),
}));

vi.mock("@/components/teacher/TeacherStage", () => ({
  default: ({
    agentName,
    previewAvatarImageSrc,
  }: {
    agentName: string;
    previewAvatarImageSrc?: string;
  }) => <img src={previewAvatarImageSrc} alt={`${agentName} preview`} />,
}));

import TeacherDemoLandingScreen from "./TeacherDemoLandingScreen";

describe("TeacherDemoLandingScreen", () => {
  it("previews the approved young teacher portrait used by LemonSlice", () => {
    render(
      <TeacherDemoLandingScreen
        phase="landing"
        onEnter={() => undefined}
        onRetry={() => undefined}
      />,
    );

    expect(screen.getByRole("img", { name: "Samira preview" })).toHaveAttribute(
      "src",
      "/images/ai-teacher-portuguese-young.png",
    );
  });
});
