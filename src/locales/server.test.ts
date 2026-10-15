import { beforeEach, expect, it, vi } from "vitest";
const cookie = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => cookie.value ? { value: cookie.value } : undefined }) }));
import { readRequestTeacherLocale } from "./server";
beforeEach(() => { cookie.value = undefined; });
it("always starts a new request in Portuguese, ignoring any saved language", async () => {
  expect(await readRequestTeacherLocale()).toBe("pt-BR");
  cookie.value = "pt-PT"; expect(await readRequestTeacherLocale()).toBe("pt-BR");
  cookie.value = "en-US"; expect(await readRequestTeacherLocale()).toBe("pt-BR");
});
