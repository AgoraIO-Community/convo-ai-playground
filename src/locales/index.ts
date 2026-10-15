import { enUS } from "./en-US";
import { ptBR } from "./pt-BR";
import { DEFAULT_TEACHER_LOCALE, type TeacherLocale } from "./types";
export * from "./types";
export const TEACHER_LOCALE_PROFILES = { "pt-BR": ptBR, "en-US": enUS } as const;
export function parseTeacherLocale(value: unknown): TeacherLocale {
  return value === "pt-BR" || value === "en-US" ? value : DEFAULT_TEACHER_LOCALE;
}
export function getTeacherLocaleProfile(locale: TeacherLocale) { return TEACHER_LOCALE_PROFILES[locale]; }
