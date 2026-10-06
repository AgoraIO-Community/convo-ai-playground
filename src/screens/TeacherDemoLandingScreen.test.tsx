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
  it("previews the same Samira identity used by the live Anam teacher", () => {
    render(
      <TeacherDemoLandingScreen
        phase="landing"
        onEnter={() => undefined}
        onRetry={() => undefined}
      />,
    );

    expect(screen.getByRole("img", { name: "Samira preview" })).toHaveAttribute(
      "src",
      "/images/ai-teacher-samira-anam.png",
    );
  });
});
