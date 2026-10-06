"use client";

import { useCallback } from "react";
import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import TeacherDemoLandingScreen from "@/screens/TeacherDemoLandingScreen";

interface TeacherHomeScreenProps {
  isAuthenticated: boolean;
}

const TeacherHomeScreen: React.FC<TeacherHomeScreenProps> = ({
  isAuthenticated,
}) => {
  const router = useRouter();

  const handleEnter = useCallback((): void => {
    if (isAuthenticated) {
      router.push("/classroom");
      return;
    }

    void signIn("google", { callbackUrl: "/classroom" });
  }, [isAuthenticated, router]);

  const handleSignOut = useCallback((): void => {
    void signOut({ callbackUrl: "/" });
  }, []);

  return (
    <TeacherDemoLandingScreen
      phase="landing"
      onEnter={handleEnter}
      onRetry={handleEnter}
      onSignOut={isAuthenticated ? handleSignOut : undefined}
    />
  );
};

export default TeacherHomeScreen;
