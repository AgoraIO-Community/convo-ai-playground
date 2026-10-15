const checkedConstructors = new WeakSet<typeof RTCPeerConnection>();

/**
 * Some embedded browsers expose setConfiguration but reject even a no-op call.
 * Probe before loading the RTC SDK so its built-in capability fallback is used.
 * This does not change ICE policy, encryption, or any supplied server credentials.
 */
export function ensureRtcConfigurationCompatibility(): void {
  const PeerConnection = globalThis.RTCPeerConnection;
  if (typeof PeerConnection !== "function" || checkedConstructors.has(PeerConnection)) return;
  const original = PeerConnection.prototype.setConfiguration;
  if (typeof original !== "function") {
    checkedConstructors.add(PeerConnection);
    return;
  }
  const probe = new PeerConnection({ iceServers: [] });
  try {
    try {
      original.call(probe, { iceServers: [] });
    } catch (error) {
      if (!error || typeof error !== "object" || !("name" in error) || error.name !== "InvalidModificationError") throw error;
      Object.defineProperty(PeerConnection.prototype, "setConfiguration", {
        value: undefined, configurable: true, writable: true,
      });
    }
    checkedConstructors.add(PeerConnection);
  } finally {
    probe.close();
  }
}
