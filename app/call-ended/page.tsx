import { redirect } from "next/navigation";
import { auth } from "@/auth";
import CallEndedScreen from "@/screens/CallEndedScreen";

export default async function CallEndedPage() {
  const session = await auth();
  if (!session) redirect("/");

  return <CallEndedScreen />;
}
