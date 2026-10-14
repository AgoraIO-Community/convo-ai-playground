import { beforeEach, describe, expect, it } from "vitest";
import { ETurnStatus, type AgentSettings } from "@/types/agora";
import useAppStore from "./useAppStore";

describe("call state", () => {
  it("clears teacher conversation without changing settings or call identity", () => {
    const item = { uid: "42", stream_id: 1, turn_id: 1, _time: 1, text: "old lesson", status: ETurnStatus.END, metadata: null };
    useAppStore.setState({ channelId: "classroom", localUID: "42", selectedMicrophoneId: "mic",
      transcriptItems: [item], currentInProgressMessage: item, userSentMessages: [{ text: "old", _time: 1 }],
      instructionLog: [{ id: "old", text: "old", status: "sent", _time: 1, options: {} }] });
    const settings = useAppStore.getState().agentSettings;
    useAppStore.getState().clearTeacherConversation();
    const state = useAppStore.getState();
    expect(state.transcriptItems).toEqual([]);
    expect(state.currentInProgressMessage).toBeNull();
    expect(state.userSentMessages).toEqual([]);
    expect(state.instructionLog).toEqual([]);
    expect(state.channelId).toBe("classroom");
    expect(state.agentSettings).toBe(settings);
    expect(state.selectedMicrophoneId).toBe("mic");
  });
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

  it("preserves RTC transcript delivery when RTM is disabled", () => {
    useAppStore.getState().setAgentSettings({
      name: "legacy-agent",
      advanced_features: { enable_rtm: false },
      parameters: { data_channel: "rtc" },
    } as AgentSettings);

    const state = useAppStore.getState();
    expect(state.agentSettings?.advanced_features?.enable_rtm).toBe(false);
    expect(state.agentSettings?.parameters?.data_channel).toBe("datastream");
    expect(state.transcriptionMode).toBe("rtc");
  });
});
