"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import type {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ILocalAudioTrack,
  ILocalVideoTrack,
} from "agora-rtc-sdk-ng";
import AgoraRTM from "agora-rtm";
import { stopAgent } from "@/api/agentApi";
import { releaseAgoraTrack } from "@/hooks/agoraTrackLifecycle";
import useAppStore from "@/store/useAppStore";
import type { RtcSessionResponse } from "@/types/rtcSession";

let rtcClient: IAgoraRTCClient | null = null;
type RtmClient = InstanceType<typeof AgoraRTM.RTM>;

let rtmClient: RtmClient | null = null;
let rtmChannelName: string | null = null;
let activeSession: RtcSessionResponse | null = null;
let rtmLifecyclePromise: Promise<void> = Promise.resolve();
const rtmClientListeners = new Set<() => void>();
let localAudioTrack: ILocalAudioTrack | null = null;
let localVideoTrack: ILocalVideoTrack | null = null;
let rtcListenersAttached = false;
let leavePromise: Promise<void> | null = null;

function emitRtmClientChange(): void {
  for (const listener of rtmClientListeners) listener();
}

function setRtmClient(nextClient: RtmClient | null): void {
  if (rtmClient === nextClient) return;
  rtmClient = nextClient;
  emitRtmClientChange();
}

function subscribeToRtmClient(listener: () => void): () => void {
  rtmClientListeners.add(listener);
  return () => rtmClientListeners.delete(listener);
}

function getRtmClientSnapshot(): RtmClient | null {
  return rtmClient;
}

interface AgoraRTCWithInternalParameters {
  setParameter(key: "ENABLE_AUDIO_PTS_METADATA", value: boolean): void;
}

function getRtcClient(): IAgoraRTCClient {
  if (!rtcClient) {
    (AgoraRTC as unknown as AgoraRTCWithInternalParameters).setParameter(
      "ENABLE_AUDIO_PTS_METADATA",
      true,
    );
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

  await disconnectRtmClient();
  activeSession = null;
}

async function disconnectRtmClient(): Promise<void> {
  if (rtmClient) {
    const client = rtmClient;
    setRtmClient(null);
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

async function connectRtmClient(session: RtcSessionResponse): Promise<RtmClient> {
  if (rtmClient) return rtmClient;

  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
  if (!appId) throw new Error("Agora App ID is not configured");

  const client = new AgoraRTM.RTM(appId, session.rtmUserId, {
    useStringUserId: true,
  });
  try {
    await client.login({ token: session.rtmToken });
    await client.subscribe(session.channelName, {
      withMessage: true,
      withPresence: true,
      withMetadata: false,
      withLock: false,
    });
  } catch (error) {
    try {
      client.removeAllListeners();
      await client.logout();
    } catch {
      // Preserve the original connection error.
    }
    throw error;
  }

  rtmChannelName = session.channelName;
  setRtmClient(client);
  return client;
}

async function configureRtmConnection(enabled: boolean): Promise<RtmClient | null> {
  let result: RtmClient | null = null;
  const operation = rtmLifecyclePromise.then(async () => {
    if (enabled) {
      if (!activeSession) {
        throw new Error("Cannot enable RTM before the RTC session is ready");
      }
      result = await connectRtmClient(activeSession);
    } else {
      await disconnectRtmClient();
      result = null;
    }
  });
  rtmLifecyclePromise = operation.then(
    () => undefined,
    () => undefined,
  );
  await operation;
  return result;
}

export const useAgora = () => {
  const localAudioTrackState = useAppStore((state) => state.localAudioTrack);
  const localVideoTrackState = useAppStore((state) => state.localVideoTrack);
  const agentAvatarRtcUid = useAppStore((state) => state.agentAvatarRtcUid);
  const avatarVideoTrack = useAppStore(
    (state) => state.agentAvatarVideoTrack,
  );
  const reactiveRtmClient = useSyncExternalStore(
    subscribeToRtmClient,
    getRtmClientSnapshot,
    () => null,
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
    async (
      session: RtcSessionResponse,
      enableRtm: boolean = true,
    ): Promise<void> => {
      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
      if (!appId) {
        throw new Error("Agora App ID is not configured");
      }

      await cleanupAgoraConnections();
      ensureRtcListeners();
      activeSession = session;

      try {
        const microphoneId = useAppStore.getState().selectedMicrophoneId;
        localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack(
          microphoneId ? { microphoneId } : undefined,
        );
        localVideoTrack = await AgoraRTC.createCameraVideoTrack();
        useAppStore
          .getState()
          .setLocalTracks(localAudioTrack, localVideoTrack);

        await configureRtmConnection(enableRtm);

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
          await stopAgent(state.agentId, state.agentSettings?.api_base_url);
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

  const configureRtm = useCallback(
    (enabled: boolean): Promise<RtmClient | null> =>
      configureRtmConnection(enabled),
    [],
  );

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

  const setLocalVideoEnabled = useCallback(
    async (enabled: boolean): Promise<void> => {
      const state = useAppStore.getState();
      const currentlyEnabled = !state.videoMuted && Boolean(localVideoTrack);
      if (currentlyEnabled === enabled) return;

      if (enabled) {
        const nextTrack = await AgoraRTC.createCameraVideoTrack();
        try {
          await getRtcClient().publish(nextTrack);
        } catch (error) {
          releaseAgoraTrack(nextTrack);
          throw error;
        }
        localVideoTrack = nextTrack;
        state.setLocalTracks(localAudioTrack, nextTrack);
        if (useAppStore.getState().videoMuted) state.toggleVideoMute();
        return;
      }

      if (localVideoTrack) {
        await getRtcClient().unpublish(localVideoTrack);
        releaseAgoraTrack(localVideoTrack);
        localVideoTrack = null;
        state.setLocalTracks(localAudioTrack, null);
      }
      if (!useAppStore.getState().videoMuted) state.toggleVideoMute();
    },
    [],
  );

  const toggleLocalVideo = useCallback(async (): Promise<void> => {
    const state = useAppStore.getState();
    await setLocalVideoEnabled(state.videoMuted);
  }, [setLocalVideoEnabled]);

  return {
    joinMeeting,
    configureRtm,
    leaveCall,
    toggleLocalAudio,
    toggleLocalVideo,
    setLocalVideoEnabled,
    localTracks: {
      audioTrack: localAudioTrackState,
      videoTrack: localVideoTrackState,
    },
    avatarVideoTrack,
    rtcClient: getRtcClient(),
    rtmClient: reactiveRtmClient,
  };
};
