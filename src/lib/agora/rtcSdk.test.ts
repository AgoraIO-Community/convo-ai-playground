import { afterEach, expect, it, vi } from "vitest";

vi.mock("agora-rtc-sdk-ng", () => ({
  default: { configurationAvailableAtLoad: typeof RTCPeerConnection.prototype.setConfiguration === "function" },
}));
afterEach(() => vi.unstubAllGlobals());

it("probes browser configuration support before the RTC SDK snapshots capabilities", async () => {
  vi.resetModules();
  class BrokenPeer {
    setConfiguration() { throw new DOMException("Unsupported native call", "InvalidModificationError"); }
    getConfiguration() { return {}; }
    close() {}
  }
  vi.stubGlobal("RTCPeerConnection", BrokenPeer);
  const { default: sdk } = await import("./rtcSdk");
  expect((sdk as unknown as { configurationAvailableAtLoad: boolean }).configurationAvailableAtLoad).toBe(false);
});
