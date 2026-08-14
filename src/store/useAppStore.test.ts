import { beforeEach, describe, expect, it } from "vitest";
import type { AgentSettings } from "@/types/agora";
import useAppStore from "./useAppStore";

describe("call state", () => {
  beforeEach(() => {
    useAppStore.getState().callEnd();
  });

  it("starts a direct Agora session with only the authenticated identity", () => {
    useAppStore.getState().callStart({
      displayName: "Ada Lovelace",
      rtcUid: "42",
      channelName: "channel-private",
      startedAt: 1234,
    });

    const state = useAppStore.getState();
    expect(state.callActive).toBe(true);
    expect(state.localUsername).toBe("Ada Lovelace");
    expect(state.localUID).toBe("42");
    expect(state.channelId).toBe("channel-private");
    expect(state.sessionStartTime).toBe(1234);
  });

  it("clears the call and agent state when a session ends", () => {
    useAppStore.getState().callStart({
      displayName: "Ada",
      rtcUid: "42",
      channelName: "channel-private",
      startedAt: 1234,
    });
    useAppStore.getState().setAgentActive("agent-1", "100", "101");

    useAppStore.getState().callEnd();

    const state = useAppStore.getState();
    expect(state.callActive).toBe(false);
    expect(state.channelId).toBe("");
    expect(state.agentId).toBeNull();
    expect(state.localAudioTrack).toBeNull();
    expect(state.localVideoTrack).toBeNull();
  });

  it("keeps RTM enabled when legacy settings are loaded or edited", () => {
    useAppStore.getState().setAgentSettings({
      name: "legacy-agent",
      advanced_features: { enable_rtm: false },
      parameters: { data_channel: "rtc" },
    } as AgentSettings);

    const state = useAppStore.getState();
    expect(state.agentSettings?.advanced_features?.enable_rtm).toBe(true);
    expect(state.agentSettings?.parameters?.data_channel).toBe("rtm");
    expect(state.transcriptionMode).toBe("rtm");
  });
});
