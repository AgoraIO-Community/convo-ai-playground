import type { TeacherLocale } from "@/locales";
import type { TeacherLessonPlan } from "@/types/teacher";
import { TeacherLessonValidationError } from "./lessonSchema";
const MARKERS: Record<TeacherLocale, readonly string[]> = {
  "en-US": ["the", "is", "with", "this", "that", "will", "then", "from", "about", "their"],
  "pt-BR": ["que", "uma", "voce", "para", "com", "nao", "entao", "quando", "isso", "sua"],
};
export function assertTeacherLessonLocale(plan: TeacherLessonPlan, locale: TeacherLocale): void {
  const text = [plan.topic, ...plan.cues.flatMap(cue => [
    cue.speech, ...cue.boardActions.flatMap(operation => {
      const content = operation.type === "update_element" ? operation.patch : operation;
      return [("text" in content ? content.text : "") ?? "", ("label" in content ? content.label : "") ?? ""];
    }),
  ])].join(" ").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const tokens = text.match(/\p{L}+/gu) ?? [];
  if (tokens.length < 16) return;
  const words = new Set(tokens);
  const wrong: TeacherLocale = locale === "pt-BR" ? "en-US" : "pt-BR";
  if (MARKERS[wrong].filter(word => words.has(word)).length >= 3 && !MARKERS[locale].some(word => words.has(word))) {
    throw new TeacherLessonValidationError(`Learner-facing content must use ${locale}; the response is clearly in ${wrong}.`);
  }
}
