import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { TeacherLocaleProvider, useTeacherLocale } from "./TeacherLocaleProvider";
function Consumer() {
  const { locale, setLocale } = useTeacherLocale();
  return <button onClick={() => setLocale("en-US")}>{locale}</button>;
}
it("hydrates from server preference and persists a selection", () => {
  render(<TeacherLocaleProvider initialLocale="pt-BR"><Consumer /></TeacherLocaleProvider>);
  expect(document.documentElement.lang).toBe("pt-BR");
  fireEvent.click(screen.getByRole("button", { name: "pt-BR" }));
  expect(screen.getByRole("button", { name: "en-US" })).toBeTruthy();
  expect(document.documentElement.lang).toBe("en-US");
  expect(document.cookie).toContain("ai_teacher_locale=en-US");
});
it("keeps the English document language for the standard call experience", () => {
  document.documentElement.lang = "en";
  render(<TeacherLocaleProvider initialLocale="pt-BR" syncDocumentLanguage={false}><Consumer /></TeacherLocaleProvider>);
  expect(document.documentElement.lang).toBe("en");
  fireEvent.click(screen.getByRole("button", { name: "pt-BR" }));
  expect(screen.getByRole("button", { name: "en-US" })).toBeTruthy();
  expect(document.documentElement.lang).toBe("en");
});
