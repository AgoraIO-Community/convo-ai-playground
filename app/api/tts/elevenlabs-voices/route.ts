import { NextRequest, NextResponse } from "next/server";

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description: string | null;
  preview_url: string;
  labels: Record<string, string>;
}

export async function GET(req: NextRequest) {
  // Allow caller to pass their own API key via header (falls back to server env)
  const callerKey = req.headers.get("x-elevenlabs-key");
  const apiKey =
    (callerKey && callerKey !== "***MASKED***" ? callerKey : "") ||
    process.env.ELEVENLABS_API_KEY ||
    process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY ||
    "";

  if (!apiKey) {
    return NextResponse.json(
      { error: "No ElevenLabs API key configured. Set ELEVENLABS_API_KEY in your environment." },
      { status: 401 },
    );
  }

  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: {
      "xi-api-key": apiKey,
    },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `ElevenLabs API error: ${res.status} ${text}` },
      { status: res.status },
    );
  }

  const data = await res.json();
  const voices: ElevenLabsVoice[] = (data.voices ?? []).map(
    (v: Record<string, unknown>) => ({
      voice_id: v.voice_id as string,
      name: v.name as string,
      category: (v.category as string) ?? "premade",
      description: (v.description as string) ?? null,
      preview_url: v.preview_url as string,
      labels: (v.labels as Record<string, string>) ?? {},
    }),
  );

  return NextResponse.json(
    { voices },
    {
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=60",
      },
    },
  );
}
