import type { englishMessages } from "./en-US";
export type TeacherLocale = "pt-BR" | "en-US";
export const DEFAULT_TEACHER_LOCALE: TeacherLocale = "pt-BR";
export const TEACHER_LOCALE_COOKIE = "ai_teacher_locale";
export type TeacherMessages = typeof englishMessages;
export interface TeacherIntentPatterns {
  resume: RegExp; clear: RegExp; stop: RegExp; negatedStop: RegExp; replace: RegExp; unfinished: RegExp;
}
export interface TeacherLocaleProfile {
  locale: TeacherLocale; htmlLang: TeacherLocale; label: string; symbol: string;
  metadata: { title: string; description: string };
  messages: TeacherMessages;
  agent: { systemPrompt: string; greeting: string; failureMessage: string };
  asr: { vendor: "deepgram"; model: "nova-3"; language: TeacherLocale };
  lessonDirector: { localeInstruction: string; returnPhrase: string };
  intents: TeacherIntentPatterns;
}
