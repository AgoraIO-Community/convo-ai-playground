import { randomInt, randomUUID } from "node:crypto";
import {
  RtcRole,
  RtcTokenBuilder,
  RtmTokenBuilder,
} from "agora-token";
import type { RtcSessionResponse } from "@/types/rtcSession";

const TOKEN_EXPIRATION_SECONDS = 3600;
const MAX_RTC_UID_EXCLUSIVE = 2_147_483_647;

interface CreateRtcSessionTokensOptions {
  appId: string;
  appCertificate: string;
  displayName: string;
}

export function createRtcSessionTokens({
  appId,
  appCertificate,
  displayName,
}: CreateRtcSessionTokensOptions): RtcSessionResponse {
  if (!appId.trim() || !appCertificate.trim()) {
    throw new Error("Agora server credentials are not configured");
  }

  const channelName = `channel-${randomUUID()}`;
  const rtcUid = randomInt(1, MAX_RTC_UID_EXCLUSIVE);
  const rtmUserId = String(rtcUid);

  return {
    channelName,
    rtcUid,
    rtmUserId,
    rtcToken: RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      rtcUid,
      RtcRole.PUBLISHER,
      TOKEN_EXPIRATION_SECONDS,
      TOKEN_EXPIRATION_SECONDS,
    ),
    rtmToken: RtmTokenBuilder.buildToken(
      appId,
      appCertificate,
      rtmUserId,
      TOKEN_EXPIRATION_SECONDS,
    ),
    displayName,
    expiresInSeconds: TOKEN_EXPIRATION_SECONDS,
  };
}
