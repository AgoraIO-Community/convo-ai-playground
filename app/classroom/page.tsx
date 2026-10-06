"use client";

import dynamic from "next/dynamic";
import TeacherClassroomLoadingScreen from "@/components/teacher/TeacherClassroomLoadingScreen";

const CallBootstrapScreen = dynamic(
  () => import("@/screens/CallBootstrapScreen"),
  { ssr: false, loading: () => <TeacherClassroomLoadingScreen /> },
);

export default function ClassroomPage() {
  return <CallBootstrapScreen startImmediately />;
}
