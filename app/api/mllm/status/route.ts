import { NextResponse } from "next/server";
import { getMllmApiKey } from "@/utils/mllmEnv";

/** Server-side check — client cannot read MLLM API keys from .env. */
export async function GET() {
  return NextResponse.json({
    openai: getMllmApiKey("openai").length > 0,
    gemini: getMllmApiKey("gemini").length > 0,
    xai: getMllmApiKey("xai").length > 0,
  });
}
