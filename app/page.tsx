import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAiTeacherModeEnabled } from "@/constants/featureFlags";
import LandingScreen from "@/screens/LandingScreen";
import TeacherHomeScreen from "@/screens/TeacherHomeScreen";

export default async function HomePage() {
  const session = await auth();

  if (isAiTeacherModeEnabled()) {
    return <TeacherHomeScreen isAuthenticated={Boolean(session)} />;
  }

  if (session) redirect("/call");

  return <LandingScreen />;
}
