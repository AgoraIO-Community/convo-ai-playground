import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureRtcConfigurationCompatibility } from "./rtcConfiguration";

afterEach(() => vi.unstubAllGlobals());

function installBrowser(requiresFullConfiguration: boolean, alwaysReject = false) {
  class Peer {
    static instances: Peer[] = [];
    config: RTCConfiguration & { alwaysNegotiateDataChannels: boolean } = {
      iceServers: [], bundlePolicy: "balanced", alwaysNegotiateDataChannels: true,
    };
    closed = false;
    constructor() { Peer.instances.push(this); }
    getConfiguration() { return { ...this.config }; }
    setConfiguration(next: RTCConfiguration & { alwaysNegotiateDataChannels?: boolean }) {
      if (alwaysReject || (requiresFullConfiguration && next.alwaysNegotiateDataChannels !== true)) {
        throw new DOMException("Unsupported configuration change", "InvalidModificationError");
      }
      if (next.bundlePolicy && next.bundlePolicy !== this.config.bundlePolicy) {
        throw new DOMException("Immutable bundle policy", "InvalidModificationError");
      }
      this.config = { ...this.config, ...next };
    }
    close() { this.closed = true; }
  }
  vi.stubGlobal("RTCPeerConnection", Peer);
  return Peer;
}

describe("RTC configuration compatibility", () => {
  it("marks the optional reconfiguration API unavailable when even an unchanged configuration fails", () => {
    const Peer = installBrowser(true, true);
    ensureRtcConfigurationCompatibility();
    expect(Peer.instances[0].closed).toBe(true);
    expect(typeof Peer.prototype.setConfiguration).toBe("undefined");
  });
  it("does not patch browsers that accept standard partial configuration updates", () => {
    const Peer = installBrowser(false);
    const original = Peer.prototype.setConfiguration;
    ensureRtcConfigurationCompatibility();
    ensureRtcConfigurationCompatibility();
    expect(Peer.prototype.setConfiguration).toBe(original);
    expect(Peer.instances).toHaveLength(1);
    expect(Peer.instances[0].closed).toBe(true);
  });
  it("does not require setConfiguration in browsers where the SDK does not use it", () => {
    class PeerWithoutUpdates {
      constructor() { throw new Error("Do not probe unsupported APIs"); }
    }
    vi.stubGlobal("RTCPeerConnection", PeerWithoutUpdates);
    expect(() => ensureRtcConfigurationCompatibility()).not.toThrow();
  });
  it("propagates unrelated browser failures and closes the probe", () => {
    const Peer = installBrowser(false);
    const reject = () => { throw new DOMException("Unrelated browser error", "NotSupportedError"); };
    Peer.prototype.setConfiguration = reject;
    expect(() => ensureRtcConfigurationCompatibility()).toThrow("Unrelated browser error");
    expect(Peer.prototype.setConfiguration).toBe(reject);
    expect(Peer.instances[0].closed).toBe(true);
  });
});
