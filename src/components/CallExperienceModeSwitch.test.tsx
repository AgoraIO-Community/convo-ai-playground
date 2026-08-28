import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CallExperienceModeSwitch from "./CallExperienceModeSwitch";

describe("CallExperienceModeSwitch", () => {
  it("exposes an accessible exclusive voice and video choice", () => {
    const onChange = vi.fn();
    render(<CallExperienceModeSwitch value="voice" onChange={onChange} />);

    expect(screen.getByRole("radio", { name: "Voice Agent" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Video Agent" })).not.toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "Video Agent" }));
    expect(onChange).toHaveBeenCalledWith("video");
  });

  it("blocks changes while a media transition is pending", () => {
    const onChange = vi.fn();
    render(
      <CallExperienceModeSwitch value="voice" onChange={onChange} disabled />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Video Agent" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
