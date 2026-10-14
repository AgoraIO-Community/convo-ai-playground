import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EAgentState } from "@/types/agora";
import { useTeacherBoardSession } from "./useTeacherBoardSession";
afterEach(() => vi.unstubAllGlobals());
it("replaces the board session on locale change and ignores a late old-language poll", async () => {
  let created = 0;
  let resolveOld: ((response: Response) => void) | undefined;
  vi.stubGlobal("fetch", vi.fn((url: string, options?: RequestInit) => {
    if (options?.method === "POST") return Promise.resolve(new Response(JSON.stringify({ sessionId: `session-${++created}`, token: "test", expiresAt: Date.now() + 60000, liveMcpConfigured: true })));
    if (options?.method === "DELETE") return Promise.resolve(new Response("{}"));
    if (url.includes("session-1")) return new Promise<Response>(resolve => { resolveOld = resolve; });
    return Promise.resolve(new Response(JSON.stringify({ events: [] })));
  }));
  const { result, rerender } = renderHook(({ locale }) => useTeacherBoardSession(EAgentState.IDLE, { locale, connectRemote: true }), { initialProps: { locale: "pt-BR" as "pt-BR" | "en-US" } });
  await waitFor(() => expect(result.current.session?.sessionId).toBe("session-1"));
  rerender({ locale: "en-US" });
  await waitFor(() => expect(result.current.session?.sessionId).toBe("session-2"));
  await act(async () => { resolveOld?.(new Response(JSON.stringify({ events: [{ eventId: 1, command: { turnId: "old", sequence: 1, animation: "instant", operations: [{ type: "add_text", elementId: "old", x: 80, y: 70, text: "Português" }] } }] }))); });
  expect(result.current.boardState.elements).not.toHaveProperty("old");
});
