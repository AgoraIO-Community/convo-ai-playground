"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import MeetingLoadingSkeleton from "@/components/MeetingLoadingSkeleton";
import TeacherClassroomLoadingScreen from "@/components/teacher/TeacherClassroomLoadingScreen";
import { isAiTeacherModeEnabled } from "@/constants/featureFlags";

const CallBootstrapScreen = dynamic(
  () => import("@/screens/CallBootstrapScreen"),
  { ssr: false, loading: () => <MeetingLoadingSkeleton /> }
);

export default function CallPage() {
  const router = useRouter();
  const teacherModeEnabled = isAiTeacherModeEnabled();

  useEffect(() => {
    if (teacherModeEnabled) router.replace("/classroom");
  }, [router, teacherModeEnabled]);

  if (teacherModeEnabled) return <TeacherClassroomLoadingScreen />;

  return <CallBootstrapScreen />;
}
