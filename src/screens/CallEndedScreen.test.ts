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
    mocks.replace.mockReset();
    mocks.signOut.mockReset();
  });

  it("starts a fresh call", () => {
    render(React.createElement(CallEndedScreen));

    fireEvent.click(screen.getByRole("button", { name: "Start new call" }));

    expect(mocks.replace).toHaveBeenCalledWith("/call");
  });

  it("signs out to the landing page", () => {
    render(React.createElement(CallEndedScreen));

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(mocks.signOut).toHaveBeenCalledWith({ callbackUrl: "/" });
  });
});
