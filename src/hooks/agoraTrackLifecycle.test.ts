import { describe, expect, it, vi } from "vitest";
import { releaseAgoraTrack } from "./agoraTrackLifecycle";

describe("releaseAgoraTrack", () => {
  it("stops the native media track before stopping and closing Agora", () => {
    const calls: string[] = [];
    const track = {
      getMediaStreamTrack: vi.fn(() => ({
        stop: vi.fn(() => calls.push("native")),
      })),
      stop: vi.fn(() => calls.push("agora-stop")),
      close: vi.fn(() => calls.push("agora-close")),
    };

    releaseAgoraTrack(track);

    expect(calls).toEqual(["native", "agora-stop", "agora-close"]);
  });

  it("continues releasing resources when one cleanup operation throws", () => {
    const stop = vi.fn(() => {
      throw new Error("native track already stopped");
    });
    const agoraStop = vi.fn();
    const close = vi.fn();

    releaseAgoraTrack({
      getMediaStreamTrack: () => ({ stop }),
      stop: agoraStop,
      close,
    });

    expect(agoraStop).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});
