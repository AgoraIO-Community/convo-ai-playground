import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { readTelephonyConfig } from "@/server/telephonyConfig";
import type { TelephonyPublicConfig } from "@/types/telephony";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  let body: TelephonyPublicConfig;
  try {
    const config = readTelephonyConfig();
    body = { configured: true, phoneNumberId: config.phoneNumberId };
  } catch {
    body = { configured: false };
  }

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
