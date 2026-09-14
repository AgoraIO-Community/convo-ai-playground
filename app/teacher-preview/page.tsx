import { notFound } from "next/navigation";
import TeacherPreviewScreen from "@/screens/TeacherPreviewScreen";

export default function TeacherPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <TeacherPreviewScreen />;
}
