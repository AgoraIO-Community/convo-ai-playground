"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_TEACHER_LOCALE, getTeacherLocaleProfile, parseTeacherLocale, serializeTeacherLocaleCookie, type TeacherLocale, type TeacherLocaleProfile } from "./index";
export interface TeacherLocaleContextValue {
  locale: TeacherLocale;
  profile: TeacherLocaleProfile;
  setLocale(locale: TeacherLocale): void;
}
const TeacherLocaleContext = createContext<TeacherLocaleContextValue>({
  locale: DEFAULT_TEACHER_LOCALE,
  profile: getTeacherLocaleProfile(DEFAULT_TEACHER_LOCALE),
  setLocale: () => { throw new Error("TeacherLocaleProvider is required to change language."); },
});
export function TeacherLocaleProvider({ children, initialLocale, syncDocumentLanguage = true }: { children: React.ReactNode; initialLocale: TeacherLocale; syncDocumentLanguage?: boolean }) {
  const [locale, updateLocale] = useState(() => parseTeacherLocale(initialLocale));
  const setLocale = useCallback((next: TeacherLocale) => {
    const valid = parseTeacherLocale(next);
    document.cookie = serializeTeacherLocaleCookie(valid, process.env.NODE_ENV === "production");
    if (syncDocumentLanguage) document.documentElement.lang = valid;
    updateLocale(valid);
  }, [syncDocumentLanguage]);
  useEffect(() => { if (syncDocumentLanguage) document.documentElement.lang = locale; }, [locale, syncDocumentLanguage]);
  const value = useMemo(() => ({ locale, profile: getTeacherLocaleProfile(locale), setLocale }), [locale, setLocale]);
  return <TeacherLocaleContext.Provider value={value}>{children}</TeacherLocaleContext.Provider>;
}
export function useTeacherLocale(): TeacherLocaleContextValue {
  return useContext(TeacherLocaleContext);
}
