import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAppStore from "@/store/useAppStore";
import type { AgentSettings } from "@/types/agora";

vi.mock("@/api/telephonyApi", () => ({
  getOutboundCallStatus: vi.fn(),
  getTelephonyConfig: vi.fn(),
  startOutboundCall: vi.fn(),
}));
vi.mock("@/services/uiService", () => ({ showToast: vi.fn() }));

import {
  getOutboundCallStatus,
  getTelephonyConfig,
  startOutboundCall,
} from "@/api/telephonyApi";
import TelephonySettings from "./TelephonySettings";

const mockedGetConfig = vi.mocked(getTelephonyConfig);
const mockedGetCallStatus = vi.mocked(getOutboundCallStatus);
const mockedStartCall = vi.mocked(startOutboundCall);

const agentSettings: AgentSettings = {
  name: "outbound-agent",
  llm: {
    vendor: "openai",
    url: "https://api.openai.com/v1/chat/completions",
    api_key: "",
    params: { model: "gpt-4o-mini" },
  },
  tts: { vendor: "minimax", credential_mode: "managed", params: {} },
  asr: { vendor: "deepgram", credential_mode: "managed", params: {} },
};

describe("TelephonySettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetConfig.mockReset();
    mockedGetCallStatus.mockReset();
    mockedStartCall.mockReset();
    window.sessionStorage.clear();
    useAppStore.setState({ agentSettings, localUsername: "Bhupendra" });
    mockedGetConfig.mockResolvedValue({ configured: true, phoneNumberId: 851 });
    mockedStartCall.mockResolvedValue({ callId: "call-1", status: "dialing" });
    mockedGetCallStatus.mockResolvedValue({ callId: "call-1", phase: "live" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the configured Agora number ID and validates E.164 input", async () => {
    render(<TelephonySettings />);

    expect(
      await screen.findByText(
        (_content, element) =>
          element?.tagName === "SPAN" &&
          element.textContent?.includes("Phone-number ID 851") === true,
      ),
    ).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Start outbound call" });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Destination phone number"), {
      target: { value: "8800112233" },
    });
    expect(screen.getByText(/Use E.164 format/i)).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it("submits the current pipeline and call options", async () => {
    mockedGetCallStatus.mockImplementation(() => new Promise(() => undefined));
    render(<TelephonySettings />);
    await screen.findByText(
      (_content, element) =>
        element?.tagName === "SPAN" &&
        element.textContent?.includes("Phone-number ID 851") === true,
    );
    fireEvent.change(screen.getByLabelText("Destination phone number"), {
      target: { value: "+918800112233" },
    });
    fireEvent.click(screen.getByLabelText("Record this call"));
    fireEvent.click(screen.getByRole("button", { name: "Start outbound call" }));

    await waitFor(() => expect(mockedStartCall).toHaveBeenCalledOnce());
    expect(mockedStartCall).toHaveBeenCalledWith({
      toNumber: "+918800112233",
      username: "Bhupendra",
      agentSettings,
      options: {
        enableRecording: true,
        maxDurationSeconds: 300,
        maxSilenceDurationMs: 60000,
        maxRingDurationMs: 30000,
        idleTimeoutSeconds: 120,
      },
    });
    expect(await screen.findByText(/Dialing/i)).toBeInTheDocument();
  });

  it("locks call controls while the outbound call is live", async () => {
    render(<TelephonySettings />);
    await screen.findByText(
      (_content, element) =>
        element?.tagName === "SPAN" &&
        element.textContent?.includes("Phone-number ID 851") === true,
    );
    const destination = screen.getByLabelText("Destination phone number");
    fireEvent.change(destination, { target: { value: "+918800112233" } });
    fireEvent.click(screen.getByRole("button", { name: "Start outbound call" }));

    expect(await screen.findByText("Live call")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Call in progress" })).toBeDisabled();
    expect(destination).toBeDisabled();
    expect(screen.getByLabelText("Record this call")).toBeDisabled();
  });

  it("polls until completion, then exposes post-call artifacts and permits another call", async () => {
    vi.useFakeTimers();
    mockedGetCallStatus
      .mockResolvedValueOnce({ callId: "call-1", phase: "live" })
      .mockResolvedValueOnce({
        callId: "call-1",
        phase: "completed",
        durationSeconds: 42,
        hangupReason: "normal_hangup",
        recordingUrl: "https://recordings.example/call.wav",
        transcript: [
          { role: "assistant", content: "Your appointment is confirmed." },
          { role: "user", content: "Thank you." },
        ],
        structuredOutput: [
          {
            variable_name: "appointment_confirmed",
            type: "boolean",
            criteria: "User confirmed",
            value: true,
          },
        ],
      });
    render(<TelephonySettings />);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.change(screen.getByLabelText("Destination phone number"), {
      target: { value: "+918800112233" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start outbound call" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Live call")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText("Call completed")).toBeInTheDocument();
    expect(screen.getByText("42 seconds")).toBeInTheDocument();
    expect(screen.getByText("Your appointment is confirmed.")).toBeInTheDocument();
    expect(screen.getByText("Thank you.")).toBeInTheDocument();
    expect(screen.getByText("appointment_confirmed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download recording" })).toHaveAttribute(
      "href",
      "/api/telephony/calls/call-1/recording",
    );
    expect(screen.getByLabelText("Call recording")).toHaveAttribute(
      "src",
      "/api/telephony/calls/call-1/recording?disposition=inline",
    );
    expect(screen.getByRole("button", { name: "Start outbound call" })).toBeEnabled();
  });

  it("keeps polling a completed recorded call until its artifacts are ready", async () => {
    vi.useFakeTimers();
    mockedGetCallStatus
      .mockResolvedValueOnce({
        callId: "call-1",
        phase: "completed",
        durationSeconds: 12,
      })
      .mockResolvedValueOnce({
        callId: "call-1",
        phase: "completed",
        durationSeconds: 12,
        recordingUrl: "https://recordings.example/call.wav",
        transcript: [{ role: "assistant", content: "Goodbye." }],
      });
    render(<TelephonySettings />);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.change(screen.getByLabelText("Destination phone number"), {
      target: { value: "+918800112233" },
    });
    fireEvent.click(screen.getByLabelText("Record this call"));
    fireEvent.click(screen.getByRole("button", { name: "Start outbound call" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Preparing recording and transcript…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start outbound call" })).toBeEnabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText("Goodbye.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download recording" })).toBeInTheDocument();
    expect(
      screen.queryByText("Preparing recording and transcript…"),
    ).not.toBeInTheDocument();
  });

  it("stops post-call artifact polling after sixty seconds", async () => {
    window.sessionStorage.setItem(
      "convoai-active-outbound-call",
      JSON.stringify({
        callId: "call-timeout",
        toNumber: "+918800112233",
        startedAt: Date.now() - 100_000,
        maxDurationSeconds: 300,
        enableRecording: true,
        artifactPollingStartedAt: Date.now() - 61_000,
      }),
    );
    mockedGetCallStatus.mockResolvedValue({
      callId: "call-timeout",
      phase: "completed",
      durationSeconds: 20,
    });

    render(<TelephonySettings />);
    expect(await screen.findByText("Call completed")).toBeInTheDocument();

    expect(window.sessionStorage.getItem("convoai-active-outbound-call")).toBeNull();
    expect(
      screen.queryByText("Preparing recording and transcript…"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start outbound call" })).toBeEnabled();
  });

  it("restores an active call after the settings panel is reopened", async () => {
    window.sessionStorage.setItem(
      "convoai-active-outbound-call",
      JSON.stringify({
        callId: "call-restored",
        toNumber: "+918800112233",
        startedAt: Date.now(),
        maxDurationSeconds: 300,
      }),
    );
    mockedGetCallStatus.mockResolvedValue({
      callId: "call-restored",
      phase: "live",
    });

    render(<TelephonySettings />);

    expect(await screen.findByText("Live call")).toBeInTheDocument();
    expect(mockedGetCallStatus).toHaveBeenCalledWith("call-restored");
    expect(screen.getByLabelText("Destination phone number")).toHaveValue(
      "+918800112233",
    );
    expect(screen.getByRole("button", { name: "Call in progress" })).toBeDisabled();
  });

  it("releases controls when a stored call is past its maximum duration", async () => {
    window.sessionStorage.setItem(
      "convoai-active-outbound-call",
      JSON.stringify({
        callId: "call-expired",
        toNumber: "+918800112233",
        startedAt: Date.now() - 500_000,
        maxDurationSeconds: 300,
      }),
    );

    render(<TelephonySettings />);
    await screen.findByText(
      (_content, element) =>
        element?.tagName === "SPAN" &&
        element.textContent?.includes("Phone-number ID 851") === true,
    );

    expect(window.sessionStorage.getItem("convoai-active-outbound-call")).toBeNull();
    expect(mockedGetCallStatus).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Destination phone number")).toHaveValue(
      "+918800112233",
    );
    expect(screen.getByRole("button", { name: "Start outbound call" })).toBeEnabled();
  });

  it("explains when server telephony is not configured", async () => {
    mockedGetConfig.mockResolvedValue({ configured: false });

    render(<TelephonySettings />);

    expect(
      await screen.findByText(/Outbound telephony is not configured/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start outbound call" })).toBeDisabled();
  });
});
