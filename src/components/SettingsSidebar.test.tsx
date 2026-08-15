import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useAppStore from "@/store/useAppStore";
import type { AgentSettings } from "@/types/agora";
import SettingsSidebar, { getDefaultSettings } from "./SettingsSidebar";

describe("SettingsSidebar transcript transport", () => {
  beforeEach(() => {
    useAppStore.getState().setAgentSettings({
      ...getDefaultSettings(),
      advanced_features: {
        ...getDefaultSettings().advanced_features,
        enable_rtm: false,
      },
      parameters: { data_channel: "rtc" },
    });
  });

  it("applies the currently selected RTC preference through its save callback", async () => {
    const onSave = vi.fn<(settings: AgentSettings) => void>();

    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0]).toMatchObject({
      advanced_features: { enable_rtm: false },
      parameters: { data_channel: "rtc" },
    });
  });
});
