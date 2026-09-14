# Synchronized Dynamic AI Teacher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Teacher Mode answer arbitrary typed or spoken questions by producing a validated lesson plan and then coordinating short board updates with matching avatar speech.

**Architecture:** A server-side Lesson Planner converts the learner question and recent context into a bounded sequence of speech-and-board cues. A client-side Lesson Director executes those cues deterministically: publish a board command, wait until the board applies it, send the matching text to Agora `/speak`, wait for that utterance to finish, then continue. The existing Teacher MCP remains available for experimentation, but lesson execution no longer depends on the autonomous model choosing an MCP tool.

**Tech Stack:** Next.js App Router, TypeScript, React hooks, Zustand transcript state, Zod, Agora ConvoAI REST API, Excalidraw, existing teacher session broker and command reducer.

**Spec:** `docs/superpowers/specs/2026-09-03-synchronized-ai-teacher-design.md`

## Global Constraints

- Keep all work on `feature/ai-teacher-excalidraw-prototype` in the existing worktree.
- Do not add or modify test files. Run existing checks only.
- Keep normal Voice Agent and Video Agent behavior unchanged.
- Do not hardcode lesson subjects, diagrams, or explanations.
- Never log API keys, Agora credentials, teacher bearer tokens, or complete model payloads.
- Treat MCP as optional; the Lesson Director uses authenticated app routes directly.

---

## Task 1: Define the lesson contract and board-wire serialization

**Files:**

- Modify: `src/types/teacher.ts`
- Create: `src/lib/teacher/lessonSchema.ts`
- Modify: `src/lib/teacher/commands.ts`

**Interfaces:**

```ts
export interface TeacherLessonCue {
  cueId: string;
  speech: string;
  boardActions: TeacherOperation[];
}

export interface TeacherLessonPlan {
  turnId: string;
  topic: string;
  cues: TeacherLessonCue[];
}

export interface TeacherLessonContextItem {
  role: "user" | "assistant";
  text: string;
}

export type TeacherLessonStatus =
  | "idle"
  | "planning"
  | "writing"
  | "explaining"
  | "interrupted"
  | "unavailable"
  | "error";
```

- [ ] Add the interfaces above to `src/types/teacher.ts` without changing existing board/session types.
- [ ] Add `parseTeacherLessonPlan(value: unknown, turnId: string): TeacherLessonPlan` in `lessonSchema.ts`.
- [ ] Validate the model wire format exactly as `{ topic, cues: [{ cue_id, speech, operations }] }`.
- [ ] Require 1–10 cues, a non-empty unique `cue_id`, speech no longer than 450 UTF-8 bytes using `TextEncoder`, no more than 16 operations per cue, and no more than 64 operations in the whole plan.
- [ ] Reuse `parseTeacherDrawRequest` for every cue by wrapping its operations as `{ turn_id: turnId, sequence: cueIndex, animation: "instant", operations }`. This keeps every operation subject to the existing command validation.
- [ ] Export `toTeacherDrawWireRequest(request: TeacherDrawRequest)` from `commands.ts`, converting internal camelCase values back to the snake_case wire contract accepted by the command route.
- [ ] Cover every existing `TeacherOperation` variant explicitly in the serializer so TypeScript reports newly added variants.
- [ ] Run `npm run lint -- --file src/types/teacher.ts --file src/lib/teacher/lessonSchema.ts --file src/lib/teacher/commands.ts`.
- [ ] Run `git diff --check` and inspect the diff for accidental changes.
- [ ] Commit with `git commit -m "feat: define synchronized teacher lesson contract"`.

---

## Task 2: Generate dynamic lesson plans on the server

**Files:**

- Create: `src/server/teacher/lessonPlanner.ts`
- Create: `app/api/teacher/lesson/route.ts`

**Server API:**

```ts
interface TeacherLessonRequestBody {
  question: string;
  context?: TeacherLessonContextItem[];
  boardSummary?: string;
}

interface TeacherLessonResponseBody {
  plan: TeacherLessonPlan;
}
```

- [ ] Resolve the planner API key in this order: `TEACHER_DIRECTOR_API_KEY`, `OPENAI_API_KEY`, then `LLM_API_KEY`.
- [ ] Resolve the model from `TEACHER_DIRECTOR_MODEL`, defaulting to `gpt-4o-mini`.
- [ ] Implement `planTeacherLesson(input, signal)` with native `fetch` to `https://api.openai.com/v1/chat/completions`; no OpenAI SDK is needed.
- [ ] Use `response_format: { type: "json_object" }`, temperature `0.2`, and a 20-second abort timeout.
- [ ] In the system prompt, require the exact JSON wire format, cue-level speech/board alignment, progressive writing, readable coordinates, concise spoken text, and only operations supported by `TeacherOperation`.
- [ ] Explicitly instruct the planner to handle arbitrary educational topics, equations, code, labels, lists, and diagrams without relying on topic templates.
- [ ] Parse `choices[0].message.content` as JSON and pass it through `parseTeacherLessonPlan` with a server-generated `randomUUID()` turn ID.
- [ ] In `POST /api/teacher/lesson`, require `sessionId` in the query and `Authorization: Bearer <session token>`; authenticate through the existing teacher session broker before invoking the model.
- [ ] Bound input before planning: question 2,000 characters; latest six context items at 500 characters each; board summary 4,000 characters.
- [ ] Return `401` for invalid teacher credentials, `503` when no planner key is configured, `422` for invalid request data, `502` for an invalid/upstream planner response, and `500` for unexpected server failure.
- [ ] Log only error category, response status, and generated turn ID; do not log credentials or complete learner content.
- [ ] Run `npm run lint -- --file src/server/teacher/lessonPlanner.ts --file app/api/teacher/lesson/route.ts`.
- [ ] Run `git diff --check` and inspect the route’s status mapping.
- [ ] Commit with `git commit -m "feat: generate dynamic teacher lesson plans"`.

---

## Task 3: Add deterministic command and speech delivery endpoints

**Files:**

- Create: `app/api/teacher/command/route.ts`
- Create: `app/api/agent/speak/route.ts`
- Modify: `src/api/agentApi.ts`

**Client APIs:**

```ts
export interface SpeakAgentInput {
  agentId: string;
  text: string;
  priority?: "INTERRUPT" | "APPEND" | "IGNORE";
  interruptable?: boolean;
}

export async function speakAgent(input: SpeakAgentInput): Promise<void>;

export async function publishTeacherCue(
  session: TeacherSessionCredentials,
  command: TeacherDrawRequest,
): Promise<{ eventId: string }>;
```

- [ ] Implement `POST /api/teacher/command?sessionId=...` with mandatory bearer authentication even when the development MCP route is open.
- [ ] Parse its body with `parseTeacherDrawRequest`, publish through the existing session broker, and return the broker’s `eventId`.
- [ ] Implement `POST /api/agent/speak` accepting `{ agentId, text, priority, interruptable }` and reject speech over 450 UTF-8 bytes.
- [ ] Reuse the Agora Basic Auth and app-ID configuration pattern from `app/api/agent/think/route.ts`.
- [ ] Forward to `/v2/projects/{appid}/agents/{agentId}/speak` with only `text`, `priority`, and `interruptable`; return `{ agentId, channel, startTs }` from the Agora response.
- [ ] Add `speakAgent` and `publishTeacherCue` to `src/api/agentApi.ts`. The latter must use `toTeacherDrawWireRequest` and send the current teacher bearer token.
- [ ] Keep error messages useful but redact response authorization data.
- [ ] With a temporary teacher session, locally probe command publication and confirm the returned event appears in its event stream; delete the temporary session afterward.
- [ ] Run `npm run lint -- --file app/api/teacher/command/route.ts --file app/api/agent/speak/route.ts --file src/api/agentApi.ts`.
- [ ] Run `git diff --check` and inspect the two request payloads.
- [ ] Commit with `git commit -m "feat: add teacher cue delivery endpoints"`.

---

## Task 4: Build the client-side Lesson Director

**File:**

- Create: `src/hooks/useTeacherLessonDirector.ts`

**Hook contract:**

```ts
interface UseTeacherLessonDirectorOptions {
  active: boolean;
  agentId: string | null;
  agentState: EAgentState;
  localUID: number | string | null;
  transcriptItems: ITranscriptHelperItem[];
  teacherSession: TeacherSessionCredentials | null;
  boardState: TeacherBoardState;
}

interface UseTeacherLessonDirectorResult {
  status: TeacherLessonStatus;
  sendTeacherQuestion(text: string): Promise<void>;
  cancelLesson(): void;
}
```

- [ ] Keep current options in refs so long-running cue execution reads the latest agent, transcript, session, and board state without restarting the hook.
- [ ] Use an `AbortController` plus a monotonically increasing generation ID; every new learner question cancels the current plan before starting another.
- [ ] Build planner context from the latest six useful transcript items and a board summary of at most 40 AI-owned elements.
- [ ] Fetch `/api/teacher/lesson` with the current session ID and bearer token.
- [ ] For each cue, publish one `TeacherDrawRequest` using its plan turn ID and sequential cue index, then set status to `writing`.
- [ ] Poll the latest board state every 25 ms until `processedEventIds` includes the returned event ID, with a three-second timeout and abort support.
- [ ] Call `speakAgent` only after the board event is applied. Use `INTERRUPT` for the first cue and `APPEND` for later cues, then set status to `explaining`.
- [ ] Wait for agent state to enter `SPEAKING` and then return to `LISTENING`, `IDLE`, or `SILENT` before advancing. Use a fallback timeout of `Math.min(45_000, Math.max(4_000, speechByteLength * 85))`.
- [ ] Detect a new finalized local voice turn using `uid === String(localUID)` and `status === ETurnStatus.END`; deduplicate with `${stream_id}:${turn_id}:${text.trim()}`.
- [ ] On a voice question, first cancel pending cues and call `/speak` with `INTERRUPT` for a short holding phrase, then request and execute the plan.
- [ ] Cancel when Teacher Mode becomes inactive, the agent stops, or the teacher session changes. Preserve board operations already applied.
- [ ] Surface `unavailable` when the planner route reports no server key and `error` for other failures without crashing the call.
- [ ] Run `npm run lint -- --file src/hooks/useTeacherLessonDirector.ts`.
- [ ] Run `git diff --check` and manually trace cancellation at every awaited boundary.
- [ ] Commit with `git commit -m "feat: orchestrate synchronized teacher cues"`.

---

## Task 5: Integrate the Lesson Director into Teacher Mode

**Files:**

- Modify: `src/screens/VideoCallScreen.tsx`
- Modify: `src/components/teacher/TeacherStage.tsx`

- [ ] Read transcript items and the local RTC UID in `VideoCallScreen` and instantiate the Director only while Teacher Mode is selected and the agent is running.
- [ ] Replace Teacher Mode’s typed-message handler with a wrapper that adds the learner message to the local transcript and calls `sendTeacherQuestion`; do not also send it to the autonomous agent.
- [ ] Reject image attachments in Teacher Mode with a clear inline notification because the first Director contract is text-only.
- [ ] Preserve the existing `sendChatMessage` handler unchanged in Voice Agent and Video Agent modes.
- [ ] Pass `lessonStatus` into `TeacherStage` and map it to visible labels: `Planning lesson`, `Writing on board`, `Explaining`, `Interrupted`, `Teacher unavailable`, and `Lesson error`.
- [ ] Keep the existing connection label when the Director is idle, including `Live board ready` after a successful heartbeat.
- [ ] Pause the canned demo when a real Director lesson begins so demo operations cannot interleave with generated operations.
- [ ] Cancel the active lesson before clearing the board.
- [ ] Run `npm run lint -- --file src/screens/VideoCallScreen.tsx --file src/components/teacher/TeacherStage.tsx`.
- [ ] Run `git diff --check` and confirm the diff does not alter normal call-mode setup.
- [ ] Commit with `git commit -m "feat: integrate synchronized teacher lessons"`.

---

## Task 6: Verify the complete prototype without adding tests

**Verification only; no test-file edits.**

- [ ] Run `git diff --name-only $(git merge-base HEAD main)..HEAD` and confirm no test file was added or modified by these tasks.
- [ ] Run lint against every changed TypeScript/TSX file.
- [ ] Run the existing suite with `npm test -- --run`; record failures exactly if the repository’s runner does not accept `--run`.
- [ ] Run `./node_modules/.bin/tsc --noEmit`. Pre-existing test typing failures may be documented, but no error may originate from a file changed by this plan.
- [ ] Restart port 3000 with the already-configured Director key and public teacher URL in the process environment, `TEACHER_DIRECTOR_MODEL=gpt-4o-mini`, and `TEACHER_MCP_OPEN_DEMO=true`.
- [ ] In Teacher Mode, type “Explain the React component lifecycle” and verify that board content appears before each matching spoken cue.
- [ ] Ask an equation question and verify the board writes symbols/steps instead of forcing a generic flowchart.
- [ ] Ask by voice for a photosynthesis explanation and verify the finalized local transcript starts a lesson without a second typed submission.
- [ ] Interrupt mid-lesson with a follow-up and verify pending cues stop, completed board work remains, and the new lesson starts with interrupt priority.
- [ ] Temporarily run without a Director key and verify `Teacher unavailable` appears while the call remains usable.
- [ ] Switch through Voice Agent and Video Agent modes and confirm their existing chat, avatar, microphone, and video behavior is unchanged.
- [ ] Run `git status --short --branch`, inspect the final commit list, and leave the worktree clean.

## Expected Result

Teacher Mode can teach an unplanned topic on demand. Each lesson is generated dynamically, validated before execution, written progressively on the Excalidraw board, and spoken by the avatar in cue-level synchronization. A new typed or spoken learner turn interrupts pending work safely, while ordinary Voice and Video modes continue to work as before.
