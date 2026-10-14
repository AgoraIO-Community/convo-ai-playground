import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), authorize: vi.fn(), limit: vi.fn(), plan: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/teacher/sessionBroker", () => ({ authorizeTeacherSession: mocks.authorize, consumeTeacherRateLimit: mocks.limit }));
vi.mock("@/server/teacher/lessonPlanner", async importOriginal => ({
  ...await importOriginal<typeof import("@/server/teacher/lessonPlanner")>(), planTeacherLesson: mocks.plan,
}));
import { POST } from "./route";
beforeEach(() => {
  mocks.auth.mockResolvedValue({ user: { email: "test@example.com" } });
  mocks.authorize.mockResolvedValue(true); mocks.limit.mockResolvedValue(true);
  mocks.plan.mockResolvedValue({ topic: "test", cues: [] });
});
function request(locale?: string) {
  return new NextRequest("http://localhost/api/teacher/lesson?sessionId=session", {
    method: "POST", headers: { Authorization: "Bearer test" },
    body: JSON.stringify({ question: "Como funciona um agente?", ...(locale === undefined ? {} : { locale }) }),
  });
}
it.each([[undefined, "pt-BR"], ["en-US", "en-US"], ["pt-BR", "pt-BR"]])("passes validated %s to planning", async (locale, expected) => {
  const response = await POST(request(locale));
  expect(response.status).toBe(200);
  expect(mocks.plan).toHaveBeenCalledWith(expect.objectContaining({ locale: expected }), expect.anything());
});
it("rejects unsupported locales before planning", async () => {
  const response = await POST(request("pt-PT"));
  expect(response.status).toBe(422); expect(mocks.plan).not.toHaveBeenCalled();
});
it("keeps teacher-session authorization required", async () => {
  mocks.authorize.mockResolvedValue(false);
  expect((await POST(request("pt-BR"))).status).toBe(401);
  expect(mocks.plan).not.toHaveBeenCalled();
});
