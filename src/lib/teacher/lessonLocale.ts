import type { TeacherLocale } from "@/locales";
import type { TeacherLessonPlan } from "@/types/teacher";
import { TeacherLessonValidationError } from "./lessonSchema";
const MARKERS: Record<TeacherLocale, readonly string[]> = {
  "en-US": ["the", "is", "with", "this", "that", "will", "then", "from", "about", "their"],
  "pt-BR": ["que", "uma", "voce", "para", "com", "nao", "entao", "quando", "isso", "sua"],
};
export function assertTeacherLessonLocale(plan: TeacherLessonPlan, locale: TeacherLocale): void {
  const combined = [plan.topic, ...plan.cues.flatMap(cue => [
    cue.speech, ...cue.boardActions.flatMap(operation => {
      const content = operation.type === "update_element" ? operation.patch : operation;
      return [("text" in content ? content.text : "") ?? "", ("label" in content ? content.label : "") ?? ""];
    }),
  ])].join(" ");
  const wrong: TeacherLocale = locale === "pt-BR" ? "en-US" : "pt-BR";
  const clearlyWrong = (value: string): boolean => {
    const tokens = value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().match(/\p{L}+/gu) ?? [];
    if (tokens.length < 16) return false;
    const words = new Set(tokens);
    return MARKERS[wrong].filter(word => words.has(word)).length >= 3 && !MARKERS[locale].some(word => words.has(word));
  };
  // A translated heading or board label must not conceal wrong-language speech.
  if ([combined, plan.cues.map(cue => cue.speech).join(" "), ...plan.cues.map(cue => cue.speech)].some(clearlyWrong)) {
    throw new TeacherLessonValidationError(`Learner-facing content must use ${locale}; the response is clearly in ${wrong}.`);
  }
}
