# Interactive Teacher Loop Design

**Date:** 2026-09-09

**Branch:** `feature/ai-teacher-excalidraw-prototype`

**Status:** Approved in chat

## Goal

Turn the synchronized Teacher Mode prototype into a continuous, visual lesson experience suitable for demonstrating to online-teaching companies. A learner asks for a topic once; the avatar then teaches the complete concept through coordinated speech and blackboard visuals. The learner can interrupt with a clarification, receive a focused explanation, and return to the unfinished main lesson automatically.

## Confirmed Problems

The current runtime treats each finalized ASR item as a new question. Agora may publish more than one finalized representation of the same spoken turn with different stream or turn identifiers. The Director therefore repeats its holding phrase, aborts its own planner request, and replaces the current lesson.

The current planner contract also accepts one cue with one `add_text` operation. Its only example is a title-only lesson. A plan containing only “Agent Loop Overview” is consequently valid even though it is not a useful lesson.

## Experience Contract

### Complete lessons

- One learner request creates one complete lesson plan.
- A normal explanatory lesson contains 4–7 cues and runs to completion without “continue” prompts.
- Each cue writes or changes the board immediately before the matching speech.
- The status badge reports the current cue, for example `Explaining · 2 of 6`.
- The teacher uses accurate, substantive explanations rather than repeatedly narrating future actions.

### Visual teaching

- Conceptual and relationship topics must use a connected visual structure, not only text.
- A normal visual plan contains at least two shapes and one connector, in addition to concise labels or a title.
- Equations, code, vocabulary, and simple factual questions may use worked text, lines, highlights, and grouped regions when boxes and arrows would be artificial.
- The planner chooses the visual language dynamically; topics and diagrams remain unhardcoded.
- If the first generated plan is structurally valid but visually shallow, the server requests one repaired plan before failing.

### Learner interruptions

- Speech finalizations are coalesced for 800 ms and normalized before execution.
- Equivalent text received again within five seconds is treated as the same learner turn even when Agora identifiers differ.
- The holding phrase is spoken once per logical learner turn.
- A genuinely new question while a lesson is active pauses the main lesson at its next unplayed cue.
- The clarification is planned against the current board and recent conversation, uses at most four focused cues, and does not clear completed lesson content.
- When the clarification completes, the teacher says a short transition and resumes the saved main lesson automatically.
- “Continue”, “go on”, and equivalent phrases resume a paused lesson. They do not create a generic new lesson or erase the board.
- A materially new topic replaces the current lesson rather than resuming it.

The four-cue clarification cap is the interpretation of the requested “zero to four” control. It is a teaching-depth limit, not an LLM token limit; setting token output to four would make structured lesson generation impossible.

## State Model

```text
idle -> planning -> writing <-> explaining -> completed
                       |
                       +-- learner interruption --> clarifying
                                                   |
                                                   +--> resume saved cue

planning/executing -- new topic --> replaced
planning/executing -- duplicate ASR --> ignored
paused -- continue --> resume saved cue
```

The client stores the current plan and the index of its next unplayed cue. Cancellation distinguishes `replace`, `clarify`, `clear`, and `shutdown` so a clarification can preserve a resumable lesson while leaving existing stop/clear behavior safe.

## Planner Contract

The lesson endpoint accepts an optional mode:

```ts
type TeacherLessonMode = "lesson" | "clarification";

interface TeacherLessonRequest {
  question: string;
  mode: TeacherLessonMode;
  context: TeacherLessonContextItem[];
  boardSummary: string;
  parentTopic?: string;
}
```

Lesson mode requests a complete 4–7 cue explanation. Clarification mode requests 1–4 focused cues that answer the learner’s confusion while preserving the visual context. Both use the same bounded `TeacherOperation` vocabulary.

The quality gate counts drawable content after schema parsing. For a normal conceptual lesson it requires at least four cues, three visible content operations, two shape operations, and one connector. For worked/text-oriented content it requires at least four cues and a structured mixture of text plus lines, focus, updates, or shapes. A shallow response is retried once with explicit repair feedback.

## Diagnostics

Log only safe orchestration metadata:

- normalized turn fingerprint, source, and duplicate decision;
- plan mode, cue count, operation count, and operation-type counts;
- cancellation reason and saved resume index;
- cue index and completion state.

Do not log full learner text, generated lesson text, board text, tokens, keys, or credentials.

## Constraints

- Keep all changes in the existing feature worktree and branch.
- Preserve Weather MCP, Teacher MCP, avatar, settings, and normal Voice/Video modes.
- The deterministic Lesson Director remains the primary drawing path; MCP is optional.
- Do not add or modify automated test files. Run existing lint, TypeScript, and test commands only.
- Phoneme-level drawing, avatar hand tracking, and web research for arbitrary lesson claims remain outside this prototype.

## Acceptance Criteria

1. “Explain the agent loop” produces a multi-step lesson with shapes, arrows, labels, and coordinated speech from one request.
2. Duplicate finalized ASR events do not repeat the holding phrase or restart the planner.
3. All planned cues run automatically unless the learner interrupts or the session ends.
4. A learner clarification pauses the main lesson, receives up to four focused cues, and then resumes the main lesson at the next unplayed cue.
5. “Continue” resumes an available paused lesson without generating an unrelated plan.
6. The board badge shows cue progress.
7. Invalid title-only or visually shallow plans are repaired once and otherwise rejected.
8. Existing Voice Agent, Video Agent, settings, avatar, and MCP configuration remain unchanged.
