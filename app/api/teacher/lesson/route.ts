import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/auth";
import { TeacherLessonValidationError } from "@/lib/teacher/lessonSchema";
import {
  planTeacherLesson,
  TeacherPlannerUnavailableError,
  TeacherPlannerUpstreamError,
} from "@/server/teacher/lessonPlanner";
import {
  authorizeTeacherSession,
  consumeTeacherRateLimit,
} from "@/server/teacher/sessionBroker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z
  .object({
    question: z.string().trim().min(1).max(2_000),
    context: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            text: z.string().trim().min(1).max(500),
          })
          .strict(),
      )
      .max(6)
      .optional()
      .default([]),
    boardSummary: z.string().max(4_000).optional().default(""),
    mode: z.enum(["lesson", "clarification"]).optional().default("lesson"),
    parentTopic: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

function bearerToken(request: NextRequest): string {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const appSession = await auth();
  if (!appSession?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  const turnId = randomUUID();
  const sessionId = request.nextUrl.searchParams.get("sessionId") ?? "";
  if (!(await authorizeTeacherSession(sessionId, bearerToken(request)))) {
    return NextResponse.json(
      { error: "Unauthorized teacher session." },
      { status: 401 },
    );
  }
  const identity =
    appSession.user.email ?? appSession.user.name ?? "authenticated-user";
  const accountBucket = createHash("sha256")
    .update(identity)
    .digest("hex");
  if (
    !(await consumeTeacherRateLimit(`lesson-account:${accountBucket}`, 30, 60))
  ) {
    return NextResponse.json(
      { error: "Too many lesson requests. Try again shortly." },
      { status: 429 },
    );
  }
  if (!(await consumeTeacherRateLimit(`lesson:${sessionId}`, 30, 60))) {
    return NextResponse.json(
      { error: "Too many lesson requests. Try again shortly." },
      { status: 429 },
    );
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 422 });
  }

  const parsed = requestSchema.safeParse(requestBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid teacher lesson request." },
      { status: 422 },
    );
  }

  try {
    const plan = await planTeacherLesson(
      {
        turnId,
        question: parsed.data.question,
        context: parsed.data.context,
        boardSummary: parsed.data.boardSummary,
        mode: parsed.data.mode,
        parentTopic: parsed.data.parentTopic,
      },
      request.signal,
    );
    return NextResponse.json(
      { plan },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof TeacherPlannerUnavailableError) {
      console.warn("[teacher-director] planner unavailable", { turnId });
      return NextResponse.json(
        { error: "Teacher lesson planning is not configured." },
        { status: 503 },
      );
    }
    if (
      error instanceof TeacherPlannerUpstreamError ||
      error instanceof TeacherLessonValidationError
    ) {
      console.error("[teacher-director] planner response rejected", {
        turnId,
        upstreamStatus:
          error instanceof TeacherPlannerUpstreamError
            ? error.upstreamStatus
            : null,
        category: error.name,
      });
      return NextResponse.json(
        { error: "Teacher lesson planner returned an invalid response." },
        { status: 502 },
      );
    }
    console.error("[teacher-director] unexpected planner failure", {
      turnId,
      category: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "Unable to prepare the teacher lesson." },
      { status: 500 },
    );
  }
}
