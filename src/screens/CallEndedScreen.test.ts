import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("next-auth/react", () => ({
  signOut: mocks.signOut,
}));

import CallEndedScreen from "./CallEndedScreen";

describe("CallEndedScreen", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mocks.replace.mockReset();
    mocks.signOut.mockReset();
  });

  it("starts another lesson from the classroom completion state", () => {
    vi.stubEnv("NEXT_PUBLIC_AI_TEACHER_MODE", "true");
    render(React.createElement(CallEndedScreen));

    expect(
      screen.getByRole("heading", { name: "Lesson complete" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("teacher-classroom-board")).toContainElement(
      screen.getByRole("status", { name: "Lesson complete" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Start another lesson" }),
    );

    expect(mocks.replace).toHaveBeenCalledWith("/classroom");
  });

  it("keeps the standard call completion flow when Teacher Mode is disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_AI_TEACHER_MODE", "false");
    render(React.createElement(CallEndedScreen));

    fireEvent.click(screen.getByRole("button", { name: "Start new call" }));

    expect(
      screen.getByRole("heading", { name: "Thanks for the conversation" }),
    ).toBeInTheDocument();
    expect(mocks.replace).toHaveBeenCalledWith("/call");
  });

  it("signs out to the landing page", () => {
    render(React.createElement(CallEndedScreen));

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(mocks.signOut).toHaveBeenCalledWith({ callbackUrl: "/" });
  });
});
