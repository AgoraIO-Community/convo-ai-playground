import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { TeacherLocaleProvider } from "@/locales/TeacherLocaleProvider";
import TeacherLanguagePicker from "./TeacherLanguagePicker";
it("changes the preference while enabled and ignores disabled clicks", () => {
  const { rerender } = render(<TeacherLocaleProvider initialLocale="pt-BR"><TeacherLanguagePicker /></TeacherLocaleProvider>);
  fireEvent.click(screen.getByRole("button", { name: "English" }));
  expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
  rerender(<TeacherLocaleProvider initialLocale="pt-BR"><TeacherLanguagePicker disabled disabledReason="Stop first" /></TeacherLocaleProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Português (Brasil)" }));
  expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
});
it("delegates classroom requests before updating context", () => {
  const request = vi.fn();
  render(<TeacherLocaleProvider initialLocale="pt-BR"><TeacherLanguagePicker onRequestLocaleChange={request} /></TeacherLocaleProvider>);
  fireEvent.click(screen.getByRole("button", { name: "English" }));
  expect(request).toHaveBeenCalledWith("en-US");
  expect(screen.getByRole("button", { name: "Português (Brasil)" })).toHaveAttribute("aria-pressed", "true");
});
