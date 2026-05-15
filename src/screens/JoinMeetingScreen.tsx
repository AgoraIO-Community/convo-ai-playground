"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useAppStore from "@/store/useAppStore";
import { joinExistingMeetingApi, AGORA_CONFIG } from "@/api/agoraApi";
import { showToast } from "@/services/uiService";
import { useAgora } from "@/hooks/useAgora";
import { MdCallMerge } from "react-icons/md";

import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import InputField from "@/components/common/InputField";
import MeetingAuthHeader from "@/components/MeetingAuthHeader";
import MeetingLoadingSkeleton from "@/components/MeetingLoadingSkeleton";

const JoinMeetingScreen: React.FC = () => {
  const callStart = useAppStore((state) => state.callStart);
  const callEnd = useAppStore((state) => state.callEnd);
  const setWhiteboardCredentials = useAppStore(
    (state) => state.setWhiteboardCredentials,
  );
  const { joinMeeting: joinAgoraMeeting } = useAgora();
  const router = useRouter();

  // Prefetch VideoCallScreen chunk so it's cached before navigation
  useEffect(() => {
    import("@/screens/VideoCallScreen").catch(() => {});
  }, []);

  const [yourName, setYourName] = useState<string>("");
  const [meetingID, setMeetingID] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleJoinMeeting = async () => {
    if (!yourName.trim() || !meetingID.trim()) {
      showToast("Please enter your name and the Meeting ID.", "error");
      return;
    }

    setIsLoading(true);
    try {
      const meetingInfo = await joinExistingMeetingApi({
        userName: yourName,
        passphrase: meetingID,
      });

      await joinAgoraMeeting(
        meetingInfo.mainUser.rtc || "",
        meetingInfo.mainUser.rtm,
        Number(meetingInfo.mainUser.uid),
        meetingInfo.channel,
        meetingInfo.title,
        meetingInfo?.hostPassphrase,
        meetingInfo?.viewerPassphrase,
        yourName,
        meetingInfo.screenShare?.rtc,
        meetingInfo.screenShare?.uid != null
          ? Number(meetingInfo.screenShare.uid)
          : undefined,
        meetingInfo.screenShare?.rtm ?? undefined,
      );

      callStart({
        userName: yourName,
        uid: meetingInfo.mainUser.uid,
        meetingName: meetingInfo.title,
        channelId: meetingInfo.channel,
        hostPassphrase: meetingInfo.hostPassphrase,
        viewerPassphrase: meetingInfo.viewerPassphrase,
        isHost: meetingInfo.isHost,
        screenShareRtcToken: meetingInfo.screenShare?.rtc,
        screenShareUid:
          meetingInfo.screenShare?.uid != null
            ? String(meetingInfo.screenShare.uid)
            : undefined,
      });

      if (
        meetingInfo.whiteboard?.room_token &&
        meetingInfo.whiteboard?.room_uuid
      ) {
        setWhiteboardCredentials(
          meetingInfo.whiteboard.room_token,
          meetingInfo.whiteboard.room_uuid,
          AGORA_CONFIG.WHITEBOARD_APPIDENTIFIER!,
          AGORA_CONFIG.WHITEBOARD_REGION!,
        );
      }

      router.push("/call");
    } catch (error) {
      console.error("Failed to join meeting:", error);
      showToast(
        "Failed to join meeting. Please check the Meeting ID and your name, then try again.",
        "error",
      );
      callEnd();
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <MeetingLoadingSkeleton />;
  }

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen-dvh bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white p-4 font-inter transition-colors duration-300">
      <MeetingAuthHeader />
      <Card>
        <div className="flex items-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white font-syne">
            Join Meeting
          </h1>
        </div>

        <InputField
          id="yourName"
          label="Your Name"
          placeholder="e.g., Alice Smith"
          value={yourName}
          onChange={(e) => setYourName(e.target.value)}
          focusRingColorClass="focus:ring-agora"
        />

        <InputField
          id="meetingID"
          label="Meeting ID"
          placeholder="Enter meeting passphrase or ID"
          value={meetingID}
          onChange={(e) => setMeetingID(e.target.value)}
          focusRingColorClass="focus:ring-agora"
          wrapperClassName="mb-6 sm:mb-8"
        />

        <Button
          onClick={handleJoinMeeting}
          disabled={isLoading}
          isLoading={isLoading}
          Icon={MdCallMerge}
          variant="primary"
        >
          Join Meeting
        </Button>

        <div className="mt-6 sm:mt-8 text-center">
          <span className="text-gray-600 dark:text-gray-400">
            Need to host?{" "}
          </span>
          <Link
            href="/"
            className="text-agora hover:opacity-90 font-semibold transition-colors duration-200 text-base sm:text-lg"
          >
            Create a New Meeting
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default JoinMeetingScreen;
