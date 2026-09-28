export function isAiTeacherModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AI_TEACHER_MODE?.trim().toLowerCase() === "true";
}
