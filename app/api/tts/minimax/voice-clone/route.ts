import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const MINIMAX_UPLOAD_URL = "https://api.minimax.io/v1/files/upload";
const MINIMAX_CLONE_URL = "https://api.minimax.io/v1/voice_clone";
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const VOICE_ID_PATTERN = /^[A-Za-z](?:[A-Za-z0-9_-]{6,254}[A-Za-z0-9])$/;
const SUPPORTED_EXTENSIONS = new Set(["mp3", "m4a", "wav"]);
const SUPPORTED_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
]);
const SUPPORTED_MODELS = new Set([
  "speech-2.8-hd",
  "speech-2.8-turbo",
  "speech-2.6-hd",
  "speech-2.6-turbo",
  "speech-02-hd",
  "speech-02-turbo",
  "speech-01-hd",
  "speech-01-turbo",
]);

type MiniMaxResponse = {
  base_resp?: { status_code?: number; status_msg?: string };
  file?: { file_id?: number | string };
  demo_audio?: string;
};

function jsonError(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

async function parseMiniMaxResponse(response: Response): Promise<MiniMaxResponse> {
  const text = await response.text();
  let body: MiniMaxResponse;
  try {
    body = JSON.parse(text) as MiniMaxResponse;
  } catch {
    throw new Error(`MiniMax returned an invalid response (${response.status}).`);
  }

  const vendorCode = body.base_resp?.status_code ?? 0;
  if (!response.ok || vendorCode !== 0) {
    const message = body.base_resp?.status_msg?.trim();
    throw new Error(
      message || `MiniMax request failed with HTTP ${response.status}.`,
    );
  }
  return body;
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
  return SUPPORTED_EXTENSIONS.has(extension) || SUPPORTED_MIME_TYPES.has(file.type);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) return jsonError("Authentication required", 401);

  const apiKey = process.env.MINIMAX_API_KEY?.trim();
  if (!apiKey) {
    return jsonError(
      "MiniMax voice cloning is not configured. Set MINIMAX_API_KEY on the server.",
      503,
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Expected a multipart voice-clone request.", 400);
  }

  const file = form.get("file");
  const voiceId = String(form.get("voiceId") ?? "").trim();
  const previewText = String(form.get("previewText") ?? "").trim();
  const requestedModel = String(form.get("model") ?? "speech-2.8-turbo").trim();
  const model = SUPPORTED_MODELS.has(requestedModel)
    ? requestedModel
    : "speech-2.8-turbo";

  if (!isUploadedFile(file) || file.size === 0) {
    return jsonError("Choose an MP3, M4A, or WAV voice sample.", 400);
  }
  if (!isSupportedAudio(file)) {
    return jsonError("Voice samples must be MP3, M4A, or WAV files.", 400);
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return jsonError("Voice samples must be 20 MB or smaller.", 413);
  }
  if (!VOICE_ID_PATTERN.test(voiceId)) {
    return jsonError(
      "Voice ID must be 8 to 256 characters, start with a letter, contain only letters, numbers, hyphens, or underscores, and end with a letter or number.",
      400,
    );
  }
  if (previewText.length > 1000) {
    return jsonError("Preview text must be 1000 characters or fewer.", 400);
  }

  const headers = { Authorization: `Bearer ${apiKey}` };

  try {
    const uploadForm = new FormData();
    uploadForm.set("purpose", "voice_clone");
    const uploadBlob = new Blob([await file.arrayBuffer()], { type: file.type });
    uploadForm.set("file", uploadBlob, file.name);
    const uploadResponse = await fetch(MINIMAX_UPLOAD_URL, {
      method: "POST",
      headers,
      body: uploadForm,
      cache: "no-store",
    });
    const uploadBody = await parseMiniMaxResponse(uploadResponse);
    const fileId = uploadBody.file?.file_id;
    if (fileId === undefined || fileId === null || fileId === "") {
      throw new Error("MiniMax accepted the upload but did not return a file ID.");
    }

    const clonePayload: Record<string, unknown> = {
      file_id: fileId,
      voice_id: voiceId,
      need_noise_reduction: false,
      need_volume_normalization: false,
    };
    if (previewText) {
      clonePayload.text = previewText;
      clonePayload.model = model;
    }

    const cloneResponse = await fetch(MINIMAX_CLONE_URL, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(clonePayload),
      cache: "no-store",
    });
    const cloneBody = await parseMiniMaxResponse(cloneResponse);

    return NextResponse.json(
      {
        voiceId,
        previewUrl:
          typeof cloneBody.demo_audio === "string" ? cloneBody.demo_audio : "",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "MiniMax voice cloning failed.";
    return jsonError(message, 502);
  }
}
