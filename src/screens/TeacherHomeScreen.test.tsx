import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { TeacherLocaleProvider } from "@/locales/TeacherLocaleProvider";
const mocks = vi.hoisted(() => ({ signIn: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("next-auth/react", () => ({ signIn: mocks.signIn, signOut: vi.fn() }));
vi.mock("@/hooks/useTeacherBoardSession", () => ({ useTeacherBoardSession: () => ({ playDemo: async () => {}, pauseDemo: () => {} }) }));
vi.mock("@/components/teacher/TeacherStage", () => ({ default: () => null }));
import TeacherHomeScreen from "./TeacherHomeScreen";
it("returns Google sign-in to the localized landing before classroom entry", () => {
  render(<TeacherLocaleProvider initialLocale="pt-BR"><TeacherHomeScreen isAuthenticated={false} /></TeacherLocaleProvider>);
  expect(screen.queryByRole("button", { name: "English" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Entrar com o Google" }));
  expect(mocks.signIn).toHaveBeenCalledWith("google", { callbackUrl: "/" });
});
it("lets authenticated learners choose English before entering", () => {
  render(<TeacherLocaleProvider initialLocale="pt-BR"><TeacherHomeScreen isAuthenticated /></TeacherLocaleProvider>);
  fireEvent.click(screen.getByRole("button", { name: "English" }));
  fireEvent.click(screen.getByRole("button", { name: "Enter the classroom" }));
  expect(mocks.push).toHaveBeenCalledWith("/classroom");
});
