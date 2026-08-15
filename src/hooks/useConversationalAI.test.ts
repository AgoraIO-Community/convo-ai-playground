import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IAgoraRTCClient } from "agora-rtc-sdk-ng";
import {
  EAgentState,
  ETurnStatus,
  ETranscriptRenderMode,
  type ITranscriptHelperItem,
} from "@/types/agora";
import useAppStore from "@/store/useAppStore";

const mocks = vi.hoisted(() => {
  interface StartOptions {
    rtcEngine: unknown;
    rtmEngine: unknown;
    channelId: string;
    localRtcUid: string;
    renderMode: ETranscriptRenderMode;
    onTranscript(snapshot: {
      completed: ITranscriptHelperItem[];
      inProgress: ITranscriptHelperItem | null;
    }): void;
    onAgentState(state: EAgentState): void;
  }

  const starts: StartOptions[] = [];
  const sessions: Array<{
    destroyed: boolean;
    messages: Array<{ agentUserId: string; message: unknown }>;
    renderModes: ETranscriptRenderMode[];
    destroy(): void;
    setRenderMode(mode: ETranscriptRenderMode): void;
    chat(agentUserId: string, message: unknown): Promise<void>;
  }> = [];

  return {
    starts,
    sessions,
    start: vi.fn(async (options: StartOptions) => {
      starts.push(options);
      const session = {
        destroyed: false,
        messages: [] as Array<{ agentUserId: string; message: unknown }>,
        renderModes: [] as ETranscriptRenderMode[],
        destroy() {
          this.destroyed = true;
        },
        setRenderMode(mode: ETranscriptRenderMode) {
          this.renderModes.push(mode);
        },
        async chat(agentUserId: string, message: unknown) {
          this.messages.push({ agentUserId, message });
        },
      };
      sessions.push(session);
      return session;
    }),
  };
});

vi.mock("@/lib/agora/clientToolkitAdapter", () => ({
  startAgoraClientToolkit: mocks.start,
}));

import { useConversationalAI } from "./useConversationalAI";

const rtcClient = {} as IAgoraRTCClient;
const rtmClient = {};

function renderActiveHook({
  mode = "rtm",
  messagingClient = rtmClient,
}: {
  mode?: "rtc" | "rtm";
  messagingClient?: unknown | null;
} = {}) {
  return renderHook(() =>
    useConversationalAI({
      rtcClient,
      rtmClient: messagingClient,
      channelId: "channel-1",
      isAgentActive: true,
      transcriptionMode: mode,
      agentRtcUid: "agent-1",
    }),
  );
}

describe("useConversationalAI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.starts.length = 0;
    mocks.sessions.length = 0;
    useAppStore.setState({
      transcriptItems: [],
      currentInProgressMessage: null,
      userSentMessages: [],
      localUID: "42",
      agentState: EAgentState.IDLE,
      transcriptRenderMode: ETranscriptRenderMode.AUTO,
    });
  });

  it("keeps transcript state and reuses the toolkit session on mode change", async () => {
    const { unmount } = renderActiveHook();

    await waitFor(() => expect(mocks.starts).toHaveLength(1));

    const completed: ITranscriptHelperItem = {
      uid: "42",
      stream_id: 0,
      turn_id: 1,
      _time: 100,
      text: "Hello",
      status: ETurnStatus.END,
      metadata: null,
    };
    const inProgress: ITranscriptHelperItem = {
      uid: "agent-1",
      stream_id: 0,
      turn_id: 2,
      _time: 200,
      text: "Hi",
      status: ETurnStatus.IN_PROGRESS,
      metadata: null,
    };

    act(() => {
      mocks.starts[0].onTranscript({ completed: [completed], inProgress });
      mocks.starts[0].onAgentState(EAgentState.SPEAKING);
    });

    expect(useAppStore.getState()).toMatchObject({
      transcriptItems: [completed],
      currentInProgressMessage: inProgress,
      agentState: EAgentState.SPEAKING,
    });

    act(() => {
      useAppStore
        .getState()
        .setTranscriptRenderMode(ETranscriptRenderMode.WORD);
    });

    await waitFor(() => {
      expect(mocks.sessions[0].renderModes).toEqual([
        ETranscriptRenderMode.WORD,
      ]);
    });
    expect(mocks.starts).toHaveLength(1);
    expect(mocks.sessions[0].destroyed).toBe(false);
    expect(useAppStore.getState()).toMatchObject({
      transcriptItems: [completed],
      currentInProgressMessage: inProgress,
    });

    unmount();
    expect(mocks.sessions[0].destroyed).toBe(true);
  });

  it("sends text through the active toolkit session and records the local echo", async () => {
    const { result } = renderActiveHook();
    await waitFor(() => expect(mocks.sessions).toHaveLength(1));

    await act(async () => {
      await result.current.sendChatMessage("  Hello agent  ");
    });

    expect(mocks.sessions[0].messages).toEqual([
      {
        agentUserId: "agent-1",
        message: expect.objectContaining({
          messageType: "text",
          text: "Hello agent",
        }),
      },
    ]);
    expect(useAppStore.getState().userSentMessages.at(-1)).toMatchObject({
      text: "Hello agent",
    });
  });

  it("starts an RTC transcript session without an RTM client", async () => {
    renderActiveHook({ mode: "rtc", messagingClient: null });

    await waitFor(() => expect(mocks.starts).toHaveLength(1));
    expect(mocks.starts[0]).toMatchObject({
      rtcEngine: rtcClient,
      rtmEngine: null,
      channelId: "channel-1",
    });
  });
});
