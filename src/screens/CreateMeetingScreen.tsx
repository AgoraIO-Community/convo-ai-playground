"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useAppStore from "@/store/useAppStore";
import { createAndJoinMeetingApi, AGORA_CONFIG } from "@/api/agoraApi";
import { showToast } from "@/services/uiService";
import { useAgora } from "@/hooks/useAgora";
import { MdAddCircleOutline } from "react-icons/md";

import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import InputField from "@/components/common/InputField";
import MeetingAuthHeader from "@/components/MeetingAuthHeader";
import MeetingLoadingSkeleton from "@/components/MeetingLoadingSkeleton";

const CreateMeetingScreen: React.FC = () => {
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
  const [meetingTitle, setMeetingTitle] = useState<string>("");
  const [hostPassphraseDisplay, setHostPassphraseDisplay] =
    useState<string>("");
  const [attendeePassphraseDisplay, setAttendeePassphraseDisplay] =
    useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleCreateMeeting = async () => {
    if (!yourName.trim() || !meetingTitle.trim()) {
      showToast("Please enter your name and a meeting title.", "error");
      return;
    }

    setIsLoading(true);
    try {
      const meetingInfo = await createAndJoinMeetingApi({
        userName: yourName,
        channelName: meetingTitle,
        role: "host",
      });

      await joinAgoraMeeting(
        meetingInfo.mainUser.rtc,
        meetingInfo.mainUser.rtm,
        Number(meetingInfo.mainUser.uid),
        meetingInfo.channel,
        meetingInfo.title,
        meetingInfo.hostPassphrase,
        meetingInfo.viewerPassphrase,
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
        isHost: true,
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
      console.error("Failed to create and join meeting:", error);
      showToast(
        "Failed to create or join meeting. Please check your network or credentials and try again.",
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
            Create a Meeting
          </h1>
        </div>

        <InputField
          id="yourName"
          label="Your Name"
          placeholder="e.g., Jane Doe"
          value={yourName}
          onChange={(e) => setYourName(e.target.value)}
          focusRingColorClass="focus:ring-agora"
        />

        <InputField
          id="meetingTitle"
          label="Meeting Title"
          placeholder="e.g., The Annual Galactic Meet"
          value={meetingTitle}
          onChange={(e) => setMeetingTitle(e.target.value)}
          focusRingColorClass="focus:ring-agora"
          wrapperClassName="mb-6 sm:mb-8"
        />

        <Button
          onClick={handleCreateMeeting}
          disabled={isLoading}
          isLoading={isLoading}
          Icon={MdAddCircleOutline}
          variant="primary"
        >
          Create Meeting
        </Button>

        {hostPassphraseDisplay && (
          <div className="mt-6 sm:mt-8 text-center p-4 sm:p-6 bg-gray-200 dark:bg-gray-700 rounded-lg shadow-inner border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm sm:text-base">
            <p className="mb-2 sm:mb-3 text-lg">
              Host Passphrase:{" "}
              <strong className="font-bold text-agora select-all">
                {hostPassphraseDisplay}
              </strong>
            </p>
            <p className="text-lg">
              Attendee Passphrase:{" "}
              <strong className="font-bold text-green-700 dark:text-green-400 select-all">
                {attendeePassphraseDisplay}
              </strong>
            </p>
            <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              Share these to invite others to your meeting.
            </p>
          </div>
        )}

        <div className="mt-6 sm:mt-8 text-center">
          <span className="text-gray-600 dark:text-gray-400">
            Already have an ID?{" "}
          </span>
          <Link
            href="/join"
            className="text-agora-accent-blue text-shadow-agora-accent-blue hover:opacity-90 font-semibold transition-colors duration-200 text-base sm:text-lg"
          >
            Join with a Meeting ID
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default CreateMeetingScreen;
