"use client";
import { useCallback } from "react";
import { TEACHER_LOCALE_PROFILES, type TeacherLocale } from "@/locales";
import { useTeacherLocale } from "@/locales/TeacherLocaleProvider";
export interface TeacherLanguagePickerProps {
  disabled?: boolean;
  disabledReason?: string;
  onRequestLocaleChange?(next: TeacherLocale): void;
}
const TeacherLanguagePicker: React.FC<TeacherLanguagePickerProps> = ({ disabled = false, disabledReason, onRequestLocaleChange }) => {
  const { locale, profile, setLocale } = useTeacherLocale();
  const select = useCallback((next: TeacherLocale) => {
    if (disabled || next === locale) return;
    if (onRequestLocaleChange) onRequestLocaleChange(next);
    else setLocale(next);
  }, [disabled, locale, onRequestLocaleChange, setLocale]);
  return (
    <div role="group" aria-label={profile.messages.classroom.language} className="inline-flex flex-wrap gap-1 rounded-full border border-white/15 bg-slate-950/70 p-1">
      {Object.values(TEACHER_LOCALE_PROFILES).map(option => (
        <button key={option.locale} type="button" disabled={disabled} aria-pressed={option.locale === locale} title={disabled ? disabledReason : undefined}
          onClick={() => select(option.locale)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 ${option.locale === locale ? "bg-cyan-300/15 text-cyan-100" : "text-slate-400 hover:text-white"}`}>
          <span aria-hidden="true">{option.symbol}</span>{option.label}
        </button>
      ))}
      {disabled && disabledReason ? <span className="sr-only">{disabledReason}</span> : null}
    </div>
  );
};
export default TeacherLanguagePicker;
