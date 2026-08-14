"use client";

import dynamic from "next/dynamic";
import MeetingLoadingSkeleton from "@/components/MeetingLoadingSkeleton";

const CallBootstrapScreen = dynamic(
  () => import("@/screens/CallBootstrapScreen"),
  { ssr: false, loading: () => <MeetingLoadingSkeleton /> }
);

export default function CallPage() {
  return <CallBootstrapScreen />;
}
