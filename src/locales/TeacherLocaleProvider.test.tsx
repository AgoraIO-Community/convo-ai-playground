import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { TeacherLocaleProvider, useTeacherLocale } from "./TeacherLocaleProvider";
function Consumer() {
  const { locale, setLocale } = useTeacherLocale();
  return <button onClick={() => setLocale("en-US")}>{locale}</button>;
}
it("changes language only for this visit and removes the legacy saved preference", () => {
  document.cookie = "ai_teacher_locale=en-US; Path=/";
  render(<TeacherLocaleProvider initialLocale="pt-BR"><Consumer /></TeacherLocaleProvider>);
  expect(document.documentElement.lang).toBe("pt-BR");
  fireEvent.click(screen.getByRole("button", { name: "pt-BR" }));
  expect(screen.getByRole("button", { name: "en-US" })).toBeTruthy();
  expect(document.documentElement.lang).toBe("en-US");
  expect(document.cookie).not.toContain("ai_teacher_locale=");
});
it("returns to Portuguese on a fresh mount after an English visit", () => {
  const first = render(<TeacherLocaleProvider initialLocale="pt-BR"><Consumer /></TeacherLocaleProvider>);
  fireEvent.click(screen.getByRole("button", { name: "pt-BR" }));
  expect(screen.getByRole("button", { name: "en-US" })).toBeTruthy();
  first.unmount();
  render(<TeacherLocaleProvider initialLocale="pt-BR"><Consumer /></TeacherLocaleProvider>);
  expect(screen.getByRole("button", { name: "pt-BR" })).toBeTruthy();
  expect(document.cookie).not.toContain("ai_teacher_locale=");
});
it("keeps the English document language for the standard call experience", () => {
  document.documentElement.lang = "en";
  render(<TeacherLocaleProvider initialLocale="pt-BR" syncDocumentLanguage={false}><Consumer /></TeacherLocaleProvider>);
  expect(document.documentElement.lang).toBe("en");
  fireEvent.click(screen.getByRole("button", { name: "pt-BR" }));
  expect(screen.getByRole("button", { name: "en-US" })).toBeTruthy();
  expect(document.documentElement.lang).toBe("en");
});
