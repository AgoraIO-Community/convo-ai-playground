import { afterEach, describe, expect, it, vi } from "vitest";
import type { OutboundCallRequest } from "@/types/telephony";
import {
  getOutboundCallStatus,
  getTelephonyConfig,
  startOutboundCall,
} from "./telephonyApi";

afterEach(() => vi.restoreAllMocks());

describe("telephonyApi", () => {
  it("loads the public server configuration without caching", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(Response.json({ configured: true, phoneNumberId: 851 }));

    await expect(getTelephonyConfig()).resolves.toEqual({
      configured: true,
      phoneNumberId: 851,
    });
    expect(fetchSpy).toHaveBeenCalledWith("/api/telephony/config", {
      cache: "no-store",
    });
  });

  it("starts an outbound call with the current settings", async () => {
    const input = {
      toNumber: "+918800112233",
      username: "Bhupendra",
      agentSettings: { name: "agent" },
      options: {
        enableRecording: false,
        maxDurationSeconds: 300,
        maxSilenceDurationMs: 60000,
        maxRingDurationMs: 30000,
        idleTimeoutSeconds: 120,
      },
    } as OutboundCallRequest;
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      Response.json({ callId: "call-1", status: "dialing" }),
    );

    await expect(startOutboundCall(input)).resolves.toEqual({
      callId: "call-1",
      status: "dialing",
    });
    expect(fetchSpy).toHaveBeenCalledWith("/api/telephony/outbound", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  });

  it("loads current call status without caching", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      Response.json({ callId: "call-1", phase: "live" }),
    );

    await expect(getOutboundCallStatus("call-1")).resolves.toEqual({
      callId: "call-1",
      phase: "live",
    });
    expect(fetchSpy).toHaveBeenCalledWith("/api/telephony/calls/call-1", {
      cache: "no-store",
    });
  });

  it("surfaces a safe API error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      Response.json({ error: "Destination number is invalid" }, { status: 400 }),
    );

    await expect(
      startOutboundCall({} as OutboundCallRequest),
    ).rejects.toThrow("Destination number is invalid");
  });
});
