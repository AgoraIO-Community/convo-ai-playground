export interface RtcSessionResponse {
  channelName: string;
  rtcUid: number;
  rtmUserId: string;
  rtcToken: string;
  rtmToken: string;
  displayName: string;
  expiresInSeconds: number;
}
