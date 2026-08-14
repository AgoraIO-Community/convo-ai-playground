import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LandingScreen from "@/screens/LandingScreen";

export default async function HomePage() {
  const session = await auth();
  if (session) redirect("/call");

  return <LandingScreen />;
}
