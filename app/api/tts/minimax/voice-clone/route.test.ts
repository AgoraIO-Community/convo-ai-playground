import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";

const mockedAuth = vi.mocked(auth);
const originalEnv = { ...process.env };

function cloneRequest(overrides?: {
  voiceId?: string;
  previewText?: string;
  file?: File;
}): NextRequest {
  const form = new FormData();
  form.set(
    "file",
    overrides?.file ??
      new File([new Uint8Array([82, 73, 70, 70])], "sample.wav", {
        type: "audio/wav",
      }),
  );
  form.set("voiceId", overrides?.voiceId ?? "MyVoice01");
  form.set("previewText", overrides?.previewText ?? "Hello from my cloned voice.");
  form.set("model", "speech-2.8-turbo");

  return new NextRequest(
    "http://localhost:3000/api/tts/minimax/voice-clone",
    { method: "POST", body: form },
  );
}

async function loadPost() {
  vi.resetModules();
  return (await import("./route")).POST;
}

describe("POST /api/tts/minimax/voice-clone", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("rejects unauthenticated voice uploads", async () => {
    mockedAuth.mockResolvedValue(null);
    const POST = await loadPost();

    const response = await POST(cloneRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication required",
    });
  });

  it("rejects invalid voice IDs before contacting MiniMax", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    process.env.MINIMAX_API_KEY = "server-minimax-key";
    const fetchSpy = vi.spyOn(global, "fetch");
    const POST = await loadPost();

    const response = await POST(cloneRequest({ voiceId: "bad" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("8 to 256"),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uploads the source audio, clones it, and returns the usable voice ID", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    process.env.MINIMAX_API_KEY = "server-minimax-key";
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          file: { file_id: 123456789, filename: "sample.wav" },
          base_resp: { status_code: 0, status_msg: "success" },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          demo_audio: "https://cdn.minimax.test/preview.mp3",
          base_resp: { status_code: 0, status_msg: "success" },
        }),
      );
    const POST = await loadPost();

    const response = await POST(cloneRequest());

    const responseBody = await response.clone().json();
    expect(response.status, JSON.stringify(responseBody)).toBe(200);
    await expect(response.json()).resolves.toEqual({
      voiceId: "MyVoice01",
      previewUrl: "https://cdn.minimax.test/preview.mp3",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const [uploadUrl, uploadInit] = fetchSpy.mock.calls[0];
    expect(uploadUrl).toBe("https://api.minimax.io/v1/files/upload");
    expect(uploadInit?.headers).toEqual({
      Authorization: "Bearer server-minimax-key",
    });
    const uploadBody = uploadInit?.body as FormData;
    expect(uploadBody.get("purpose")).toBe("voice_clone");
    expect(uploadBody.get("file")).toBeInstanceOf(File);

    const [cloneUrl, cloneInit] = fetchSpy.mock.calls[1];
    expect(cloneUrl).toBe("https://api.minimax.io/v1/voice_clone");
    expect(JSON.parse(String(cloneInit?.body))).toEqual({
      file_id: 123456789,
      voice_id: "MyVoice01",
      text: "Hello from my cloned voice.",
      model: "speech-2.8-turbo",
      need_noise_reduction: false,
      need_volume_normalization: false,
    });
  });
});
