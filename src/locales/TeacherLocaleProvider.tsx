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
export function TeacherLocaleProvider({ children, initialLocale }: { children: React.ReactNode; initialLocale: TeacherLocale }) {
  const [locale, updateLocale] = useState(() => parseTeacherLocale(initialLocale));
  const setLocale = useCallback((next: TeacherLocale) => {
    const valid = parseTeacherLocale(next);
    document.cookie = serializeTeacherLocaleCookie(valid, process.env.NODE_ENV === "production");
    document.documentElement.lang = valid;
    updateLocale(valid);
  }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const value = useMemo(() => ({ locale, profile: getTeacherLocaleProfile(locale), setLocale }), [locale, setLocale]);
  return <TeacherLocaleContext.Provider value={value}>{children}</TeacherLocaleContext.Provider>;
}
export function useTeacherLocale(): TeacherLocaleContextValue {
  return useContext(TeacherLocaleContext);
}
