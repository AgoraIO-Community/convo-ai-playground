import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AgentGlyph from "./AgentGlyph";

describe("AgentGlyph", () => {
  it("is decorative by default and can expose an accessible identity", () => {
    const { rerender } = render(<AgentGlyph size="control" />);
    expect(screen.getByTestId("agent-glyph")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    rerender(<AgentGlyph decorative={false} />);
    expect(screen.getByRole("img", { name: "AI agent" })).toBeInTheDocument();
  });
});
