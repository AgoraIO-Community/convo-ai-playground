# Interactive Teacher Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Teacher Mode deliver complete visual lessons automatically and handle learner clarifications as resumable side paths.

**Architecture:** Strengthen the server planner with lesson modes and a visual-quality repair pass. Replace per-transcript execution in the client Director with a coalesced logical-turn queue and a resumable lesson frame, while continuing to use the existing authenticated command and Agora speech endpoints.

**Tech Stack:** Next.js App Router, TypeScript, React hooks, Zod, Agora ConvoAI REST/RTM, Excalidraw.

**Spec:** `docs/superpowers/specs/2026-09-09-interactive-teacher-loop-design.md`

## Global Constraints

- Work only on `feature/ai-teacher-excalidraw-prototype` in its existing worktree.
- Do not add or modify automated test files and do not use TDD.
- Preserve normal Voice Agent and Video Agent behavior, saved settings, avatar configuration, Weather MCP, and Teacher MCP.
- Do not log learner text, board text, API keys, bearer tokens, or complete provider payloads.
- Keep lesson subjects and board content dynamic rather than hardcoded.

---

### Task 1: Strengthen the dynamic lesson contract

**Files:**

- Modify: `src/types/teacher.ts`
- Modify: `src/lib/teacher/lessonSchema.ts`
- Modify: `src/server/teacher/lessonPlanner.ts`
- Modify: `app/api/teacher/lesson/route.ts`

**Interfaces:**

- Consume: the existing `TeacherLessonPlan`, `TeacherLessonCue`, and `TeacherOperation` types.
- Produce: `TeacherLessonMode`, optional planner `parentTopic`, visual operation statistics, and a one-time repair pass for shallow plans.

- [ ] Add `TeacherLessonMode = "lesson" | "clarification"` and accept it in the lesson route, defaulting to `lesson`.
- [ ] Change the planner instruction from 1–10 generic cues to 4–7 complete lesson cues or 1–4 clarification cues.
- [ ] Replace the title-only JSON example with a compact connected-diagram example containing labeled shapes and arrows.
- [ ] Validate visual quality after structural parsing. Reject normal lessons with fewer than four cues or insufficient visible structure; keep clarification validation bounded but lighter.
- [ ] When quality validation rejects the first response, call the provider once more with concise repair feedback and validate the replacement.
- [ ] Log only plan mode, cue count, total operations, operation-type counts, and whether repair was used.
- [ ] Run ESLint on the four changed files and run `git diff --check`.

### Task 2: Coalesce Agora transcript finalizations

**Files:**

- Modify: `src/hooks/useTeacherLessonDirector.ts`

**Interfaces:**

- Consume: finalized local `ITranscriptHelperItem` values.
- Produce: one logical learner turn after an 800 ms quiet window, with normalized duplicate suppression for five seconds.

- [ ] Normalize learner text by lowercasing, removing punctuation noise, and collapsing whitespace.
- [ ] Keep only the newest candidate while the 800 ms coalescing timer is active.
- [ ] Suppress an equivalent normalized question for five seconds regardless of `stream_id` or `turn_id`.
- [ ] Mark all observed physical transcript identities so rerenders cannot enqueue them again.
- [ ] Speak the holding phrase once only after a logical turn passes duplicate suppression.
- [ ] Add safe logs containing a non-reversible short fingerprint, source, and duplicate/cancellation decisions.
- [ ] Clean up the coalescing timer and active request on unmount.
- [ ] Run ESLint on the hook and run `git diff --check`.

### Task 3: Execute resumable main lessons and clarifications

**Files:**

- Modify: `src/types/teacher.ts`
- Modify: `src/hooks/useTeacherLessonDirector.ts`

**Interfaces:**

- Produce: `TeacherLessonProgress { current: number; total: number }`, a saved lesson frame `{ plan, nextCueIndex }`, and status `clarifying`.

- [ ] Extract cue playback into an abort-aware executor that starts at a supplied cue index and reports the next unplayed index.
- [ ] Save the main frame when a new learner question arrives during an executing main lesson.
- [ ] Request the interruption as a `clarification` plan with the main topic and current board summary.
- [ ] Execute at most four clarification cues, then speak a short transition and resume the saved main frame automatically.
- [ ] Recognize “continue”, “go on”, “please continue”, “carry on”, and “resume” as resume intents when a saved frame exists.
- [ ] Treat typed or spoken new-topic requests made with no resumable frame as fresh complete lessons.
- [ ] Preserve already-applied board elements throughout clarification and resume.
- [ ] Clear resumable state when the board is cleared, Teacher Mode closes, the agent stops, or the call ends.
- [ ] Run ESLint on the changed files and run `git diff --check`.

### Task 4: Expose useful lesson progress

**Files:**

- Modify: `src/components/teacher/TeacherStage.tsx`
- Modify: `src/screens/VideoCallScreen.tsx`

**Interfaces:**

- Consume: `lessonDirector.progress` and the `clarifying` status.
- Produce: `Writing · n of total`, `Explaining · n of total`, and `Answering question · n of total` labels.

- [ ] Pass cue progress from `VideoCallScreen` to `TeacherStage`.
- [ ] Update the compact board badge for planning, lesson cue progress, clarification progress, interruption, failure, and ready state.
- [ ] Keep avatar PiP, layout controls, transcript panel, and non-teacher call stages unchanged.
- [ ] Run ESLint on both files and run `git diff --check`.

### Task 5: Existing verification only

**Files:** No source edits and no test-file edits.

- [ ] Run the repository’s existing test suite with `npm test`.
- [ ] Run `npx tsc --noEmit` and attribute any pre-existing errors precisely.
- [ ] Run lint on every implementation file changed by this plan.
- [ ] Confirm `git diff --name-only` contains no added or modified test file.
- [ ] Restart the existing worktree dev server on port 3000.
- [ ] Inspect server logs during one complete visual lesson and confirm one planner request, several board command requests, and several speech requests.
- [ ] Manually verify one interruption returns to the next main cue without a “continue” prompt.
- [ ] Report any browser-only step that could not be verified without pretending it passed.
