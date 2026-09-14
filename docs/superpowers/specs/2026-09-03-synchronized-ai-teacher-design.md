# Synchronized Dynamic AI Teacher Design

**Date:** 2026-09-03

**Branch:** `feature/ai-teacher-excalidraw-prototype`
**Status:** Approved in chat; awaiting written-spec review

## Goal

Extend the existing Teacher Mode into a dynamic lesson experience in which the configured Agora avatar teaches arbitrary topics while Excalidraw writes and draws the matching material at the same teaching-cue boundaries.

The content is generated on demand. Topics, explanations, text, equations, code, labels, and diagrams are not hardcoded. Only the safe board-operation vocabulary and layout constraints are fixed.

Normal Voice Agent and Video Agent modes must remain unchanged.

## User Experience

When Teacher Mode is active and the agent is running, the student can type or speak a question such as:

- “Explain photosynthesis.”
- “Teach me the React component lifecycle.”
- “Solve 2x + 4 = 10 step by step.”
- “Explain a balance sheet.”

The teacher responds as a sequence of short cues. Each cue contains one spoken segment and the board actions that visually support that segment. Before or as a cue begins speaking, the corresponding text or drawing appears on the board. The next cue does not begin until the current speech segment completes.

Teacher Mode supports:

- headings, sentences, bullets, equations, and short code snippets;
- rectangles, ellipses, diamonds, arrows, lines, and labeled process flows;
- progressive additions, updates, highlights, focus changes, and erasing;
- follow-up questions using recent conversation and board context;
- interruption that cancels unplayed cues while preserving completed board work.

Synchronization is intentionally defined at short teaching-cue granularity. The prototype does not attempt phoneme-level pen animation or avatar hand tracking.

## Approaches Considered

### 1. Lesson Director controls speech and board — selected

A dedicated planner generates a single structured lesson plan containing both speech and board actions. A client orchestrator sends exact speech segments through Agora TTS and publishes the paired board operations in sequence. This provides deterministic cue-level synchronization and does not depend on the agent voluntarily selecting an MCP tool.

### 2. Draw from the assistant transcript — rejected

Reading the assistant transcript after it is spoken introduces latency and requires guessing which visual corresponds to free-form speech. It cannot guarantee ordering or synchronization.

### 3. Continue relying on MCP tool selection — retained only as optional capability

The custom `teacher_draw` MCP endpoint and Excalidraw command path remain useful for inspection and future integrations. However, live tests showed that the model can discover the tool and verbally promise to call it without issuing `tools/call`. MCP selection therefore cannot be the primary lesson trigger.

## Architecture

```text
Typed message or completed local-user transcript
                    |
                    v
          Teacher input coordinator
                    |
                    v
       POST /api/teacher/lesson
                    |
                    v
       Dynamic structured lesson plan
                    |
                    v
       Client lesson cue orchestrator
          |                     |
          v                     v
 POST /api/teacher/command   POST /api/agent/speak
          |                     |
          v                     v
 Teacher session stream      Agora TTS/avatar
          |
          v
 Excalidraw board
```

The Lesson Director does not parse or imitate the assistant transcript. It creates the spoken script and visuals together from the student input, recent lesson context, and a compact summary of the current board.

The existing agent remains responsible for RTC presence, ASR, TTS, interruption detection, transcript delivery, and avatar video. In Teacher Mode, the Director becomes the source of teaching responses. Outside Teacher Mode, the existing autonomous agent behavior is unchanged.

## Lesson Plan Contract

The server returns a validated plan using the following conceptual contract:

```ts
interface TeacherLessonPlan {
  turnId: string;
  topic: string;
  cues: TeacherLessonCue[];
}

interface TeacherLessonCue {
  cueId: string;
  speech: string;
  boardActions: TeacherOperation[];
}
```

Rules:

- A plan contains 1–10 cues.
- Each `speech` value is non-empty and no more than 450 UTF-8 bytes, staying below Agora `/speak`'s 512-byte limit.
- Each cue contains 0–16 board operations.
- The complete plan contains at most 64 board operations.
- IDs are stable within the turn and are prefixed with the generated `turnId`.
- The first visual cue establishes a title or current focus unless the request is a small follow-up.
- The planner may return text-only board actions when a diagram is unnecessary.
- Every plan is parsed and validated before any cue is executed. Invalid plans produce no partial lesson.

The existing `TeacherOperation` union remains the rendering boundary. The Director cannot submit raw Excalidraw scene JSON, scripts, HTML, arbitrary URLs, or unsupported element types.

## Dynamic Lesson Generation

`POST /api/teacher/lesson` accepts an authenticated teacher session, the student question, a bounded recent conversation summary, and a compact board summary. It invokes an OpenAI-compatible model with a structured-output instruction and validates the result using a server-side schema.

Director credentials are server-only:

1. `TEACHER_DIRECTOR_API_KEY`, when configured;
2. `OPENAI_API_KEY` as the fallback;
3. `LLM_API_KEY` as the final fallback.

`TEACHER_DIRECTOR_MODEL` selects the planner model and defaults to `gpt-4o-mini` for this prototype. The browser never receives the key. Agora-managed LLM credentials cannot be reused by this endpoint because Agora does not expose those credentials to the application.

If no Director credential is configured, Teacher Mode remains visually available but shows “Lesson planner unavailable” and does not pretend to start a synchronized lesson.

The planner prompt requires concise, speakable cues and board content that complements rather than duplicates every spoken word. It chooses among writing, equations, code, diagrams, highlights, and erasing based on the topic.

## Typed Input Flow

While Teacher Mode is active, the transcript input is routed to the Teacher input coordinator rather than directly to `sendChatMessage`:

1. Add the typed question to the existing local transcript display.
2. Cancel any active lesson turn.
3. Request a new lesson plan.
4. Begin the cue orchestrator when the complete plan validates.

The typed request is not also sent to the autonomous Agora LLM. This prevents duplicate answers. Images remain on the existing chat path for this prototype; Teacher Mode rejects a lesson request containing only an image with a clear message.

## Voice Input Flow

The existing Agora ASR pipeline continues to produce completed local-user transcript items. The Teacher input coordinator watches only final items belonging to the local RTC UID and deduplicates them by stable transcript identity plus normalized text.

On a new completed spoken question:

1. Cancel the active lesson turn.
2. Immediately broadcast a short interruptible holding phrase, such as “Let’s put that on the board,” with `/speak` priority `INTERRUPT`. This prevents an independently generated agent response from taking over while the Director plans.
3. Request and validate the dynamic lesson plan.
4. Start cue execution.

If the autonomous agent has begun speaking before the final transcript arrives, the `INTERRUPT` broadcast replaces that interaction. The application never tries to recover synchronization by parsing the autonomous reply.

## Speech and Board Synchronization

For each cue, the orchestrator performs this sequence:

1. Publish the cue's board actions as one progressive `TeacherDrawRequest` through `/api/teacher/command`.
2. Wait for the board event to be acknowledged by the current browser session.
3. Send the exact `speech` text through `/api/agent/speak`.
4. Use priority `INTERRUPT` for the first cue of a new or interrupted turn and `APPEND` for later cues.
5. Observe the existing RTM agent-state stream.
6. Advance only after the agent enters `SPEAKING` for the cue and then returns to `LISTENING`, `IDLE`, or `SILENT`.

The speech call uses `interruptable: true`, allowing the student to interrupt naturally. A bounded duration derived from UTF-8 text length acts as a recovery timeout if an expected state transition is lost. Timeout advances only when the current lesson generation is still active.

The board normally changes immediately before the teacher says the matching sentence, which mirrors a presenter putting a point on screen and then explaining it. Fine-grained pen strokes synchronized to individual syllables are out of scope.

## Interruption and Follow-ups

Every lesson execution owns an `AbortController` and a monotonically increasing client generation number. A new typed question, a new completed local-user voice turn, leaving Teacher Mode, stopping the agent, or ending the call aborts the current execution.

On interruption:

- do not send remaining speech cues;
- do not publish remaining board actions;
- retain board operations already acknowledged;
- mark the previous `turnId` interrupted using the existing board state behavior;
- allow the new plan to update, extend, or clear AI-owned elements;
- preserve student-created Excalidraw annotations unless the student explicitly requests a full clear.

Recent completed cues and a compact board summary are included in a follow-up request so the teacher can answer “Why does that happen?” or “Show the next step” without recreating the entire lesson.

## Server Endpoints

### `POST /api/teacher/lesson`

Validates teacher-session authorization and input limits, calls the Director model, validates the complete plan, and returns the normalized lesson plan. It uses a request timeout and does not publish board events itself.

### `POST /api/teacher/command`

Accepts a session-bound normalized `TeacherDrawRequest`, reuses the existing command parser and broker, and returns the accepted event ID. This is the deterministic application-controlled equivalent of `teacher_draw`.

### `POST /api/agent/speak`

Proxies Agora's `POST /v2/projects/{appid}/agents/{agentId}/speak` with a maximum 512-byte text payload, `INTERRUPT | APPEND | IGNORE` priority, and `interruptable` boolean. It uses the same server-side Agora authentication pattern as the existing `/think`, `/update`, and `/stop` routes.

The existing MCP endpoint remains available but is not invoked by the Director pathway.

## Client Boundaries

- `src/hooks/useTeacherLessonDirector.ts`: owns input deduplication, lesson requests, cue sequencing, state-transition waits, cancellation, and current lesson status.
- `src/lib/teacher/lessonSchema.ts`: defines shared normalized lesson-plan types, limits, and parsing.
- `src/server/teacher/lessonPlanner.ts`: owns the Director prompt, provider call, structured response extraction, and server validation.
- `app/api/teacher/lesson/route.ts`: authenticated lesson-planning boundary.
- `app/api/teacher/command/route.ts`: authenticated direct board-command boundary.
- `app/api/agent/speak/route.ts`: authenticated Agora TTS broadcast proxy.
- `src/api/agentApi.ts`: adds the typed client helper for `/api/agent/speak`.
- `src/screens/VideoCallScreen.tsx`: selects normal chat or Teacher input routing and passes the current agent/session/state into the Director hook.
- `src/components/teacher/TeacherStage.tsx`: displays planning, speaking, paused, interrupted, and error states without owning orchestration.

The existing board reducer, Excalidraw adapter, avatar PiP, MCP route, session broker, settings, and non-teacher call stages retain their current responsibilities.

## Status and Error Handling

Teacher Stage exposes one compact state label:

- `Live board ready`
- `Planning lesson`
- `Writing · 2 of 6`
- `Explaining · 2 of 6`
- `Interrupted`
- `Lesson planner unavailable`
- `Lesson failed — try again`

Error behavior:

- Planner authentication/configuration errors stop the new lesson and preserve the board.
- Invalid structured output is rejected as a whole and never partially drawn.
- Board-command failure stops the turn before its speech is broadcast, preventing speech/visual divergence.
- `/speak` failure stops later cues and retains already acknowledged board content.
- Lost agent-state events use a bounded recovery timeout rather than hanging forever.
- Leaving Teacher Mode aborts planning and cue execution without stopping the underlying call.
- Failures in the Director, board, or TTS path never break RTC, RTM, settings, normal chat modes, or call termination.

## Security and Limits

- Director and Agora credentials remain server-side and are masked in logs.
- Teacher session authorization is required for lesson and command endpoints even when the development-only open MCP flag is enabled.
- Student text, conversation context, cue counts, speech bytes, operation counts, coordinates, and generated board text are bounded.
- The Director receives only the minimum recent context required for the lesson.
- The development-only unauthenticated MCP endpoint remains disabled in production.
- Arbitrary code execution, URLs, file operations, and raw Excalidraw scene injection remain prohibited.

## Verification Strategy

Per the user's explicit instruction, implementation will not add or modify automated test files and will not use TDD. Existing tests remain unchanged and will be run as regression protection.

Verification will include:

- lint all modified implementation files;
- run the existing test suite;
- run the existing TypeScript check and distinguish pre-existing test-file errors from new implementation errors;
- inspect a Teacher Mode agent invite to confirm Voice/Video settings remain preserved;
- manually verify a typed lesson produces multiple synchronized speech/board cues;
- manually verify a spoken lesson request is deduplicated and replaces autonomous speech;
- interrupt during a multi-cue lesson and verify pending speech/drawing stops;
- ask a follow-up and verify existing board content is updated rather than blindly duplicated;
- exercise text, equations, code, and a diagram across multiple topics;
- verify missing planner credentials, invalid plan output, board failure, and `/speak` failure produce visible non-destructive errors;
- verify normal Voice and Video chat behavior remains unchanged;
- confirm no test files changed before committing implementation.

## Acceptance Criteria

1. Teacher Mode generates lessons dynamically from typed and spoken student questions.
2. The Director, not the autonomous agent transcript, is the source of both spoken lesson text and board actions.
3. The board can write explanatory text, bullets, equations, labels, and code in addition to diagrams.
4. Each board cue is acknowledged before its matching speech cue starts.
5. Later cues wait for the previous Agora speech segment to finish.
6. Student interruption cancels all unplayed speech and board cues while preserving completed content.
7. Follow-up questions use recent lesson and board context.
8. Missing credentials or subsystem failures are visible and do not break the call.
9. Voice Agent and Video Agent behavior is unchanged when Teacher Mode is inactive.
10. No automated test files are added or modified.

## Out of Scope

- Avatar hand, marker, or body animation tied to Excalidraw strokes.
- Phoneme-, syllable-, or word-level drawing synchronization.
- Image-only lesson requests or generated image placement on the board.
- Arbitrary raw Excalidraw scene generation.
- Multi-user board collaboration or persistent lesson storage.
- Production multi-instance broker infrastructure.
- Replacing Agora RTC, RTM, ASR, TTS, avatar, transcript, telephony, settings, or call lifecycle systems.
