import { getTeacherLocaleProfile, type TeacherLocale } from "@/locales";
export function normalizeLearnerText(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}
export function isUnfinishedQuestionStem(value: string, locale: TeacherLocale): boolean {
  return getTeacherLocaleProfile(locale).intents.unfinished.test(normalizeLearnerText(value));
}
export function classifyTeacherIntent(value: string, locale: TeacherLocale): "resume" | "clear" | "stop" | "replace" | null {
  const text = normalizeLearnerText(value);
  const patterns = getTeacherLocaleProfile(locale).intents;
  const negatedClear = locale === "pt-BR"
    ? /\b(nao|nunca)\s+(limpe|limpa|limpar|apague|apaga|apagar|reinicie)\b/
    : /\b(don t|do not|never)\s+(clear|reset|erase|wipe)\b/;
  if (patterns.clear.test(text) && !negatedClear.test(text)) return "clear";
  if (patterns.replace.test(text)) return "replace";
  if (text.length <= 100 && !patterns.negatedStop.test(text) && patterns.stop.test(text)) return "stop";
  if (patterns.resume.test(text)) return "resume";
  return null;
}
