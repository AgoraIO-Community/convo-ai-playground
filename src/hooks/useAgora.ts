"use client";

import { useCallback, useEffect } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import type {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ILocalAudioTrack,
  ILocalVideoTrack,
} from "agora-rtc-sdk-ng";
import AgoraRTM from "agora-rtm-sdk";
import { stopAgent } from "@/api/agentApi";
import { releaseAgoraTrack } from "@/hooks/agoraTrackLifecycle";
import useAppStore from "@/store/useAppStore";
import type { RtcSessionResponse } from "@/types/rtcSession";

let rtcClient: IAgoraRTCClient | null = null;
let rtmClient: InstanceType<typeof AgoraRTM.RTM> | null = null;
let rtmChannelName: string | null = null;
let localAudioTrack: ILocalAudioTrack | null = null;
let localVideoTrack: ILocalVideoTrack | null = null;
let rtcListenersAttached = false;
let leavePromise: Promise<void> | null = null;

function getRtcClient(): IAgoraRTCClient {
  if (!rtcClient) {
    rtcClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
  }
  return rtcClient;
}

async function handleUserPublished(
  user: IAgoraRTCRemoteUser,
  mediaType: "audio" | "video",
): Promise<void> {
  const client = getRtcClient();
  try {
    await client.subscribe(user, mediaType);
    if (mediaType === "audio" && user.audioTrack) {
      user.audioTrack.play();
      user.audioTrack.setVolume?.(100);
    }

    const avatarUid = useAppStore.getState().agentAvatarRtcUid;
    if (
      mediaType === "video" &&
      avatarUid &&
      String(user.uid) === avatarUid &&
      user.videoTrack
    ) {
      useAppStore.getState().setAgentAvatarVideoTrack(user.videoTrack);
    }
  } catch (error) {
    console.error("Unable to subscribe to Agora media", error);
  }
}

function clearAvatarTrackForUser(user: IAgoraRTCRemoteUser): void {
  const avatarUid = useAppStore.getState().agentAvatarRtcUid;
  if (avatarUid && String(user.uid) === avatarUid) {
    useAppStore.getState().setAgentAvatarVideoTrack(null);
  }
}

function ensureRtcListeners(): void {
  if (rtcListenersAttached) return;
  const client = getRtcClient();
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", (user, mediaType) => {
    if (mediaType === "video") clearAvatarTrackForUser(user);
  });
  client.on("user-left", clearAvatarTrackForUser);
  rtcListenersAttached = true;
}

async function cleanupAgoraConnections(): Promise<void> {
  releaseAgoraTrack(localAudioTrack);
  releaseAgoraTrack(localVideoTrack);
  localAudioTrack = null;
  localVideoTrack = null;
  useAppStore.getState().setLocalTracks(null, null);
  useAppStore.getState().setAgentAvatarVideoTrack(null);

  if (rtcClient) {
    try {
      if (rtcClient.connectionState !== "DISCONNECTED") {
        await rtcClient.leave();
      }
    } catch (error) {
      console.warn("Unable to leave Agora RTC cleanly", error);
    }
  }

  if (rtmClient) {
    const client = rtmClient;
    rtmClient = null;
    try {
      if (rtmChannelName) await client.unsubscribe(rtmChannelName);
    } catch (error) {
      console.warn("Unable to unsubscribe from Agora RTM cleanly", error);
    }
    try {
      client.removeAllListeners();
      await client.logout();
    } catch (error) {
      console.warn("Unable to log out from Agora RTM cleanly", error);
    }
  }

  rtmChannelName = null;
}

export const useAgora = () => {
  const localAudioTrackState = useAppStore((state) => state.localAudioTrack);
  const localVideoTrackState = useAppStore((state) => state.localVideoTrack);
  const agentAvatarRtcUid = useAppStore((state) => state.agentAvatarRtcUid);
  const avatarVideoTrack = useAppStore(
    (state) => state.agentAvatarVideoTrack,
  );

  useEffect(() => {
    if (!agentAvatarRtcUid) {
      useAppStore.getState().setAgentAvatarVideoTrack(null);
      return;
    }
    const avatarUser = getRtcClient().remoteUsers.find(
      (user) => String(user.uid) === agentAvatarRtcUid,
    );
    useAppStore
      .getState()
      .setAgentAvatarVideoTrack(avatarUser?.videoTrack ?? null);
  }, [agentAvatarRtcUid]);

  const joinMeeting = useCallback(
    async (session: RtcSessionResponse): Promise<void> => {
      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
      if (!appId) {
        throw new Error("Agora App ID is not configured");
      }

      await cleanupAgoraConnections();
      ensureRtcListeners();

      try {
        const microphoneId = useAppStore.getState().selectedMicrophoneId;
        localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack(
          microphoneId ? { microphoneId } : undefined,
        );
        localVideoTrack = await AgoraRTC.createCameraVideoTrack();
        useAppStore
          .getState()
          .setLocalTracks(localAudioTrack, localVideoTrack);

        rtmClient = new AgoraRTM.RTM(appId, session.rtmUserId, {
          useStringUserId: true,
        });
        rtmChannelName = session.channelName;
        await rtmClient.login({ token: session.rtmToken });
        await rtmClient.subscribe(session.channelName, {
          withMessage: true,
          withPresence: true,
          withMetadata: false,
          withLock: false,
        });

        const client = getRtcClient();
        await client.join(
          appId,
          session.channelName,
          session.rtcToken,
          session.rtcUid,
        );
        await client.publish([localAudioTrack, localVideoTrack]);
      } catch (error) {
        await cleanupAgoraConnections();
        throw error;
      }
    },
    [],
  );

  const leaveCall = useCallback(async (): Promise<void> => {
    if (leavePromise) return leavePromise;

    leavePromise = (async () => {
      const state = useAppStore.getState();
      if (state.agentId) {
        try {
          await stopAgent(state.agentId);
        } catch (error) {
          console.warn("Unable to stop the agent before leaving", error);
        }
      }

      try {
        await fetch("/api/upload/clear", { method: "POST" });
      } catch (error) {
        console.warn("Unable to clear temporary call uploads", error);
      }

      await cleanupAgoraConnections();
      useAppStore.getState().callEnd();
    })().finally(() => {
      leavePromise = null;
    });

    return leavePromise;
  }, []);

  const toggleLocalAudio = useCallback(async (): Promise<void> => {
    const state = useAppStore.getState();
    if (state.audioMuted) {
      localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack(
        state.selectedMicrophoneId
          ? { microphoneId: state.selectedMicrophoneId }
          : undefined,
      );
      await getRtcClient().publish(localAudioTrack);
      state.setLocalTracks(localAudioTrack, localVideoTrack);
    } else if (localAudioTrack) {
      await getRtcClient().unpublish(localAudioTrack);
      releaseAgoraTrack(localAudioTrack);
      localAudioTrack = null;
      state.setLocalTracks(null, localVideoTrack);
    }
    state.toggleAudioMute();
  }, []);

  const toggleLocalVideo = useCallback(async (): Promise<void> => {
    const state = useAppStore.getState();
    if (state.videoMuted) {
      localVideoTrack = await AgoraRTC.createCameraVideoTrack();
      await getRtcClient().publish(localVideoTrack);
      state.setLocalTracks(localAudioTrack, localVideoTrack);
    } else if (localVideoTrack) {
      await getRtcClient().unpublish(localVideoTrack);
      releaseAgoraTrack(localVideoTrack);
      localVideoTrack = null;
      state.setLocalTracks(localAudioTrack, null);
    }
    state.toggleVideoMute();
  }, []);

  return {
    joinMeeting,
    leaveCall,
    toggleLocalAudio,
    toggleLocalVideo,
    localTracks: {
      audioTrack: localAudioTrackState,
      videoTrack: localVideoTrackState,
    },
    avatarVideoTrack,
    rtcClient: getRtcClient(),
    rtmClient,
  };
};
