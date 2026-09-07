import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const ELEVENLABS_CLONE_URL = "https://api.elevenlabs.io/v1/voices/add";
const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_PREVIEW_MODEL = "eleven_flash_v2_5";
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set([
  "mp3",
  "m4a",
  "mp4",
  "wav",
  "webm",
  "ogg",
]);

type ElevenLabsCloneResponse = {
  voice_id?: string;
  requires_verification?: boolean;
  detail?: unknown;
};

function jsonError(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { name?: unknown }).name === "string" &&
    typeof (value as { size?: unknown }).size === "number" &&
    typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function"
  );
}

function isSupportedAudio(file: File): boolean {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return file.type.startsWith("audio/") || SUPPORTED_EXTENSIONS.has(extension);
}

function usableKey(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "";
  const key = value.trim();
  return key === "***MASKED***" || key === "__USE_SERVER__" ? "" : key;
}

function detailMessage(detail: unknown): string {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((entry) => {
        if (!entry || typeof entry !== "object") return "";
        const message = (entry as { msg?: unknown }).msg;
        return typeof message === "string" ? message : "";
      })
      .filter(Boolean);
    if (messages.length > 0) return messages.join("; ");
  }
  return "";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) return jsonError("Authentication required", 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Expected a multipart voice-clone request.", 400);
  }

  const apiKey =
    usableKey(form.get("apiKey")) || process.env.ELEVENLABS_API_KEY?.trim() || "";
  if (!apiKey) {
    return jsonError(
      "ElevenLabs voice cloning is not configured. Enter a key in TTS settings or set ELEVENLABS_API_KEY on the server.",
      503,
    );
  }

  const file = form.get("file");
  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const removeBackgroundNoise =
    String(form.get("removeBackgroundNoise") ?? "false") === "true";
  const model = String(form.get("model") ?? "").trim() || DEFAULT_PREVIEW_MODEL;
  const previewText = String(form.get("previewText") ?? "").trim();

  if (!name) return jsonError("Enter a name for the cloned voice.", 400);
  if (name.length > 100) {
    return jsonError("Voice names must be 100 characters or fewer.", 400);
  }
  if (!isUploadedFile(file) || file.size === 0) {
    return jsonError("Choose or record a voice sample.", 400);
  }
  if (!isSupportedAudio(file)) {
    return jsonError("The selected file must be an audio recording.", 400);
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return jsonError("Voice samples must be 20 MB or smaller.", 413);
  }

  const vendorForm = new FormData();
  vendorForm.set("name", name);
  const audioBlob = new Blob([await file.arrayBuffer()], { type: file.type });
  vendorForm.append("files", audioBlob, file.name);
  vendorForm.set("remove_background_noise", String(removeBackgroundNoise));
  if (description) vendorForm.set("description", description);

  try {
    const response = await fetch(ELEVENLABS_CLONE_URL, {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: vendorForm,
      cache: "no-store",
    });
    const text = await response.text();
    let body: ElevenLabsCloneResponse;
    try {
      body = JSON.parse(text) as ElevenLabsCloneResponse;
    } catch {
      return jsonError(
        `ElevenLabs returned an invalid response (${response.status}).`,
        502,
      );
    }

    if (!response.ok) {
      return jsonError(
        detailMessage(body.detail) ||
          `ElevenLabs voice cloning failed with HTTP ${response.status}.`,
        response.status >= 400 && response.status < 500 ? response.status : 502,
      );
    }
    if (!body.voice_id) {
      return jsonError(
        "ElevenLabs accepted the sample but did not return a voice ID.",
        502,
      );
    }

    let previewUrl: string | undefined;
    let previewError: string | undefined;
    if (previewText) {
      try {
        const previewResponse = await fetch(
          `${ELEVENLABS_TTS_URL}/${encodeURIComponent(body.voice_id)}?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "xi-api-key": apiKey,
            },
            body: JSON.stringify({ text: previewText, model_id: model }),
            cache: "no-store",
          },
        );
        if (previewResponse.ok) {
          const contentType =
            previewResponse.headers.get("content-type")?.split(";", 1)[0] ||
            "audio/mpeg";
          const audio = Buffer.from(await previewResponse.arrayBuffer()).toString(
            "base64",
          );
          previewUrl = `data:${contentType};base64,${audio}`;
        } else {
          previewError = `ElevenLabs preview generation failed with HTTP ${previewResponse.status}.`;
        }
      } catch {
        previewError = "ElevenLabs preview generation could not be completed.";
      }
    }

    return NextResponse.json(
      {
        voiceId: body.voice_id,
        requiresVerification: body.requires_verification ?? false,
        ...(previewUrl ? { previewUrl } : {}),
        ...(previewError ? { previewError } : {}),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "ElevenLabs voice cloning failed.",
      502,
    );
  }
}
