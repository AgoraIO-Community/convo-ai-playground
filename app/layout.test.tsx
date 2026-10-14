import { afterEach, expect, it, vi } from "vitest";
vi.mock("next/font/google", () => ({ Syne: () => ({ variable: "font" }) }));
vi.mock("./providers", () => ({ Providers: () => null }));
vi.mock("@/locales/server", () => ({ readRequestTeacherLocale: async () => "pt-BR" }));
import RootLayout, { generateMetadata } from "./layout";
afterEach(() => vi.unstubAllEnvs());
it("preserves standard experience metadata and document language", async () => {
  vi.stubEnv("NEXT_PUBLIC_AI_TEACHER_MODE", "false");
  expect((await RootLayout({ children: null })).props.lang).toBe("en");
  expect((await generateMetadata()).title).toBe("My Agora AI App");
});
it("uses the Brazilian profile on teacher deployments", async () => {
  vi.stubEnv("NEXT_PUBLIC_AI_TEACHER_MODE", "true");
  expect((await RootLayout({ children: null })).props.lang).toBe("pt-BR");
  expect((await generateMetadata()).title).toBe("Professora de IA | Agora");
});
