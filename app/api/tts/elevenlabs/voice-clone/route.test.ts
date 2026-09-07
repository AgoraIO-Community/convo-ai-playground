import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";

const mockedAuth = vi.mocked(auth);
const originalEnv = { ...process.env };

function cloneRequest(overrides?: {
  apiKey?: string;
  name?: string;
  removeBackgroundNoise?: boolean;
  file?: File;
  model?: string;
  previewText?: string;
}): NextRequest {
  const form = new FormData();
  form.set(
    "file",
    overrides?.file ??
      new File([new Uint8Array([82, 73, 70, 70])], "sample.mp3", {
        type: "audio/mpeg",
      }),
  );
  form.set("name", overrides?.name ?? "My ElevenLabs Voice");
  form.set("description", "Created in the ConvoAI Playground");
  form.set(
    "removeBackgroundNoise",
    String(overrides?.removeBackgroundNoise ?? false),
  );
  form.set("model", overrides?.model ?? "eleven_flash_v2_5");
  form.set(
    "previewText",
    overrides?.previewText ?? "This is the cloned voice preview.",
  );
  if (overrides?.apiKey) form.set("apiKey", overrides.apiKey);

  return new NextRequest(
    "http://localhost:3000/api/tts/elevenlabs/voice-clone",
    { method: "POST", body: form },
  );
}

async function loadPost() {
  vi.resetModules();
  return (await import("./route")).POST;
}

describe("POST /api/tts/elevenlabs/voice-clone", () => {
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

  it("requires an ElevenLabs key before contacting the vendor", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    delete process.env.ELEVENLABS_API_KEY;
    const fetchSpy = vi.spyOn(global, "fetch");
    const POST = await loadPost();

    const response = await POST(cloneRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("ELEVENLABS_API_KEY"),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("creates an instant clone and returns its usable voice ID", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    process.env.ELEVENLABS_API_KEY = "server-elevenlabs-key";
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          voice_id: "voice_clone_123",
          requires_verification: false,
        }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([73, 68, 51]), {
          headers: { "Content-Type": "audio/mpeg" },
        }),
      );
    const POST = await loadPost();

    const response = await POST(
      cloneRequest({ removeBackgroundNoise: true }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      voiceId: "voice_clone_123",
      requiresVerification: false,
      previewUrl: "data:audio/mpeg;base64,SUQz",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.elevenlabs.io/v1/voices/add");
    expect(init?.headers).toEqual({
      "xi-api-key": "server-elevenlabs-key",
    });
    const body = init?.body as FormData;
    expect(body.get("name")).toBe("My ElevenLabs Voice");
    expect(body.get("description")).toBe("Created in the ConvoAI Playground");
    expect(body.get("remove_background_noise")).toBe("true");
    expect(body.get("files")).toBeInstanceOf(File);

    const [previewUrl, previewInit] = fetchSpy.mock.calls[1];
    expect(previewUrl).toBe(
      "https://api.elevenlabs.io/v1/text-to-speech/voice_clone_123?output_format=mp3_44100_128",
    );
    expect(previewInit).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": "server-elevenlabs-key",
      },
      cache: "no-store",
    });
    expect(JSON.parse(String(previewInit?.body))).toEqual({
      text: "This is the cloned voice preview.",
      model_id: "eleven_flash_v2_5",
    });
  });

  it("returns the clone when ElevenLabs cannot generate the preview", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    process.env.ELEVENLABS_API_KEY = "server-elevenlabs-key";
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          voice_id: "voice_clone_789",
          requires_verification: false,
        }),
      )
      .mockResolvedValueOnce(
        Response.json(
          { detail: { message: "Insufficient credits" } },
          { status: 402 },
        ),
      );
    const POST = await loadPost();

    const response = await POST(cloneRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      voiceId: "voice_clone_789",
      requiresVerification: false,
      previewError: "ElevenLabs preview generation failed with HTTP 402.",
    });
  });

  it("prefers the key supplied in the current TTS settings", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    process.env.ELEVENLABS_API_KEY = "server-elevenlabs-key";
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          voice_id: "voice_clone_456",
          requires_verification: false,
        }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([73, 68, 51]), {
          headers: { "Content-Type": "audio/mpeg" },
        }),
      );
    const POST = await loadPost();

    await POST(cloneRequest({ apiKey: "settings-elevenlabs-key" }));

    expect(fetchSpy.mock.calls[0][1]?.headers).toEqual({
      "xi-api-key": "settings-elevenlabs-key",
    });
    expect(fetchSpy.mock.calls[1][1]?.headers).toEqual({
      "Content-Type": "application/json",
      "xi-api-key": "settings-elevenlabs-key",
    });
  });
});
