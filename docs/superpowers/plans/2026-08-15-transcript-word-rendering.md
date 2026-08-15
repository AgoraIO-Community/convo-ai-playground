# Transcript Word Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Text, Word, and Auto transcript modes behave as labeled by wiring Agora audio PTS metadata into progressive agent-word rendering and adding accessible control tooltips.

**Architecture:** Keep the current local Conversational AI toolkit and singleton RTC/RTM lifecycle. Enable Agora audio PTS before RTC client creation, forward `audio-pts` events through `ConversationalAIAPI`, and let `SubRenderController` derive visible text from canonical transcript metadata. A separate hook effect changes the active mode without resubscribing, while a focused render-mode control component owns accessible buttons and tooltips.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zustand, Agora RTC Web 4.23, Agora RTM 2.2, Vitest, Testing Library, Tailwind CSS.

## Global Constraints

- Work only in the isolated `codex/transcript-word-rendering` worktree.
- Preserve completed transcript history, transcript ordering, chat behavior, RTC/RTM lifecycle, and the existing panel layout.
- Follow the official Agora contract: call `AgoraRTC.setParameter("ENABLE_AUDIO_PTS_METADATA", true)` before `AgoraRTC.createClient()`, subscribe to `audio-pts`, and compare audio PTS directly with each word's `start_ms`.
- Do not synthesize timing, add a Chunk control, or migrate to the published toolkit package.
- Treat malformed word entries and non-finite/non-positive PTS as unavailable timing and fall back to complete text.
- Join Agora word strings with `""`, not an inserted space; the service-provided word values preserve their own spacing.
- Write each failing test first, observe the expected failure, make the smallest production change, and rerun the focused test before committing.
- Do not run `npm audit fix`; dependency-audit findings are outside this feature.

---

## Task 1: Enable Agora audio PTS before RTC client creation

**Files:**

- Modify: `src/hooks/useAgora.test.ts`
- Modify: `src/hooks/useAgora.ts`

- [ ] Extend the hoisted Agora mock in `src/hooks/useAgora.test.ts` with a `setParameter` spy that records the operation order:

```ts
setParameter: vi.fn((key: string, value: boolean) => {
  order.push(`set-parameter:${key}:${value}`);
}),
createClient: vi.fn(() => {
  order.push("create-client");
  return rtcClient;
}),
```

Expose `setParameter` from the mocked default export. Add `vi.resetModules()` in `beforeEach` so every test gets a fresh module-level RTC singleton. Keep the existing RTC client and track mocks unchanged.

- [ ] Add a focused test that renders `useAgora`, starts a session, and proves PTS is enabled before client creation:

```ts
it("enables audio PTS metadata before creating the RTC client", async () => {
  const { useAgora } = await import("./useAgora");
  const { result } = renderHook(() => useAgora());

  await result.current.joinMeeting(session);

  expect(mocks.setParameter).toHaveBeenCalledWith(
    "ENABLE_AUDIO_PTS_METADATA",
    true,
  );
  expect(mocks.order.indexOf("set-parameter:ENABLE_AUDIO_PTS_METADATA:true"))
    .toBeLessThan(mocks.order.indexOf("create-client"));
});
```

- [ ] Run the focused test and verify RED because `setParameter` is not called:

```bash
npm test -- src/hooks/useAgora.test.ts
```

- [ ] In `getRtcClient()` in `src/hooks/useAgora.ts`, configure metadata immediately before the singleton is created:

```ts
if (!rtcClient) {
  AgoraRTC.setParameter("ENABLE_AUDIO_PTS_METADATA", true);
  rtcClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
}
```

- [ ] Rerun the focused test and verify GREEN. If the existing order assertion now includes the new initialization entries, assert the relevant subsequence rather than removing coverage for login, subscribe, join, and publish.

- [ ] Commit this slice:

```bash
git add src/hooks/useAgora.ts src/hooks/useAgora.test.ts
git commit -m "feat: enable Agora transcript PTS metadata"
```

---

## Task 2: Implement deterministic PTS-driven transcript rendering

**Files:**

- Create: `src/conversational-ai-api/utils/sub-render.test.ts`
- Modify: `src/conversational-ai-api/utils/sub-render.ts`

- [ ] Add factory helpers in the new test file for agent messages with stable word timings:

```ts
const agentMessage = (
  overrides: Partial<IAgentTranscription> = {},
): IAgentTranscription => ({
  object: "assistant.transcription",
  text: "Hello world",
  start_ms: 100,
  duration_ms: 250,
  language: "en-US",
  turn_id: 1,
  stream_id: 0,
  user_id: "agent-1",
  turn_status: ETurnStatus.IN_PROGRESS,
  quiet: false,
  turn_seq_id: 1,
  words: [
    { word: "Hello", start_ms: 100, duration_ms: 80, stable: true },
    { word: " world", start_ms: 250, duration_ms: 100, stable: true },
  ],
  ...overrides,
});
```

Use the exact required fields from `IAgentTranscription`; do not weaken production types to accommodate tests.

- [ ] Write tests for these externally visible behaviors:

  - Text mode returns the full incoming text.
  - Word mode with valid words and a valid PTS returns `"Hello"` at PTS 100 and `"Hello world"` at PTS 250.
  - Word strings are concatenated exactly as provided, with no injected spaces.
  - Auto uses word rendering only after a valid audio PTS clock exists; otherwise it returns full text for that turn.
  - Explicit Word falls back to full text when words are absent/malformed or no valid PTS clock exists.
  - `setRenderMode(TEXT)` restores the canonical full text for the active turn, and switching back to Word derives from the latest PTS without replaying from zero.
  - PTS never rewinds and duplicate PTS values do not emit duplicate updates.
  - A completed turn shows final full text and never changes on later PTS or mode updates.
  - An interrupted turn preserves its currently visible text and never changes on later PTS.
  - `clear()`/`destroy()` removes transcript and timing state.

For Word and Auto progression tests, call `setPts(100)` before processing the in-progress message, assert the initial visible `"Hello"`, then advance to 250 and assert `"Hello world"`. This mirrors Agora's continuously advancing audio clock and avoids making the test depend on a synthetic timer. Use a real `SubRenderController` and an `onTranscriptUpdated` spy. Assert transcript text and status, not private maps or method call counts unrelated to the public behavior.

- [ ] Run the test and verify RED because `setPts`, `setRenderMode`, and update notifications do not exist and Word mode still returns full text:

```bash
npm test -- src/conversational-ai-api/utils/sub-render.test.ts
```

- [ ] Extend `SubRenderControllerOptions` with an optional update callback and replace the unused timer map with explicit render state:

```ts
export interface SubRenderControllerOptions {
  renderMode: ETranscriptHelperMode | ETranscriptRenderMode;
  enableLog?: boolean;
  onTranscriptUpdated?: () => void;
}

interface AgentTurnRenderState {
  key: string;
  effectiveMode: ETranscriptHelperMode;
  finalStatus: ETurnStatus;
  interrupted: boolean;
}
```

Keep canonical data in `item.metadata`; keep only derived `item.text` in the display item. Track the latest valid PTS as `number | null` and active agent turns by message key.

- [ ] Add narrow helpers rather than embedding all logic in `processAgentTranscription`:

```ts
type AgentWord = NonNullable<IAgentTranscription["words"]>[number];

private getValidWords(transcription: IAgentTranscription): AgentWord[];
private getEffectiveMode(transcription: IAgentTranscription): ETranscriptHelperMode;
private deriveVisibleText(transcription: IAgentTranscription): string;
private updateActiveAgentTurns(): boolean;
private notifyIfChanged(changed: boolean): void;
```

`getValidWords` must reject entries with an empty/non-string `word`, non-finite `start_ms`, or negative `start_ms`, then sort by `start_ms`. The renderer should reveal every entry whose `start_ms <= latestPts` and concatenate `word` with `join("")`.

- [ ] Implement the public timing and mode contracts:

```ts
public setPts(pts: number): void {
  if (
    !Number.isFinite(pts) ||
    pts <= 0 ||
    (this.latestPts !== null && pts <= this.latestPts)
  ) return;
  this.latestPts = pts;
  this.notifyIfChanged(this.updateActiveAgentTurns());
}

public setRenderMode(
  mode: ETranscriptHelperMode | ETranscriptRenderMode,
): void {
  if (mode === this.renderMode) return;
  this.renderMode = mode;
  this.notifyIfChanged(this.updateActiveAgentTurns());
}
```

AUTO/UNKNOWN selects Word only when valid words and a valid PTS are already available; otherwise the current turn stays on complete Text fallback. Explicit Word follows the same safety fallback when the clock is unavailable. Store that effective choice per active turn so the first late PTS event cannot make a Text fallback regress from full text to a shorter prefix; an explicit UI mode change may recalculate the active turn.

- [ ] Update `processAgentTranscription` so only in-progress agent turns are progressively derived. Completed turns always use `transcription.text`, retain `turn_status`, and leave the active-turn map. User transcript processing remains unchanged.

- [ ] Update `markInterrupted` to preserve the current displayed text, set `INTERRUPTED`, mark the turn frozen, and remove it from active PTS rendering.

- [ ] Update `clear()` and `destroy()` to clear `messageMap`, active agent render state, and the PTS clock. Remove `wordTimers` and all comments claiming the UI will perform a future animation.

- [ ] Rerun the focused test until GREEN, then run the existing suite to catch type/behavior regressions:

```bash
npm test -- src/conversational-ai-api/utils/sub-render.test.ts
npm test
```

- [ ] Commit this slice:

```bash
git add src/conversational-ai-api/utils/sub-render.ts src/conversational-ai-api/utils/sub-render.test.ts
git commit -m "feat: render agent transcript words from audio PTS"
```

---

## Task 3: Bridge RTC `audio-pts` and expose live mode changes

**Files:**

- Create: `src/conversational-ai-api/index.test.ts`
- Modify: `src/conversational-ai-api/index.ts`

- [ ] Build small fake RTC and RTM engines in `index.test.ts`. The RTC fake should retain listeners by event name and expose a variadic `emit` helper that invokes the saved listeners; the RTM fake only needs the event-listener methods used by `subscribeMessage()`.

- [ ] Write integration tests against the public API that prove:

  - `subscribeMessage()` binds both `stream-message` and `audio-pts`.
  - An agent transcription received through `stream-message`, followed by audio PTS, emits progressively updated complete-history snapshots.
  - `setRenderMode(TEXT)` updates the current snapshot without calling `subscribeMessage()` again or duplicating RTC listeners.
  - `unsubscribe()` removes both RTC handlers and later PTS events cannot update transcripts.

Initialize/destroy the singleton in `beforeEach`/`afterEach` so tests cannot leak handlers or transcript state.

- [ ] Run the focused test and verify RED because `audio-pts` is not bound and the API has no live setter:

```bash
npm test -- src/conversational-ai-api/index.test.ts
```

- [ ] Add a stable audio handler field next to `handleStreamMessage`:

```ts
private handleAudioPts: ((pts: number) => void) | null = null;
```

- [ ] When constructing `SubRenderController`, pass a callback that emits the current complete-history snapshot whenever PTS or mode changes visible text:

```ts
this.subRenderController = new SubRenderController({
  renderMode: this.renderMode,
  enableLog: this.enableLog,
  onTranscriptUpdated: () => this.emitTranscriptUpdated(),
});
```

- [ ] In `bindRtcEvents()`, register the handler before or alongside the existing stream handler:

```ts
this.handleAudioPts = (pts: number) => {
  this.subRenderController?.setPts(pts);
};
this.rtcEngine.on(ERTCEvents.AUDIO_PTS, this.handleAudioPts);
```

In `unbindRtcEvents()`, pass the same function reference to `off()` and null it. Do not call `removeAllListeners()` during normal unsubscribe because that would remove Agora listeners owned by `useAgora`.

- [ ] Add a public setter that works before and after subscription:

```ts
public setRenderMode(mode: ETranscriptHelperMode): void {
  this.renderMode = mode;
  this.subRenderController?.setRenderMode(mode);
}
```

- [ ] Rerun the focused integration test and the controller test:

```bash
npm test -- src/conversational-ai-api/index.test.ts
npm test -- src/conversational-ai-api/utils/sub-render.test.ts
```

- [ ] Commit this slice:

```bash
git add src/conversational-ai-api/index.ts src/conversational-ai-api/index.test.ts
git commit -m "feat: bridge Agora audio PTS to transcripts"
```

---

## Task 4: Wire Zustand mode changes into the active toolkit

**Files:**

- Create: `src/hooks/useConversationalAI.test.ts`
- Modify: `src/hooks/useConversationalAI.ts`

- [ ] Mock the `ConversationalAIAPI` boundary in the hook test with one stable API object implementing `on`, `off`, `subscribeMessage`, `unsubscribe`, `setAgentRtcUid`, and `setRenderMode`. Use a real Zustand store update and Testing Library `renderHook`/`rerender`.

- [ ] Add a test that starts the hook with an active call, changes `transcriptRenderMode` from Auto to Word and then Text, and proves:

  - the toolkit was initialized and subscribed exactly once;
  - `setRenderMode(WORD)` and `setRenderMode(TEXT)` were called after the store changes;
  - the call was not unsubscribed or reinitialized merely because the mode changed.

- [ ] Run the focused test and verify RED because the current mode is only read during initialization:

```bash
npm test -- src/hooks/useConversationalAI.test.ts
```

- [ ] Keep the existing stable render-mode getter for initialization, then add a separate effect after the subscription effect:

```ts
useEffect(() => {
  if (!toolkitInitializedRef.current) return;

  try {
    ConversationalAIAPI.getInstance().setRenderMode(getToolkitRenderMode());
  } catch (error) {
    console.warn("[useConversationalAI] Unable to update render mode", error);
  }
}, [transcriptRenderMode, getToolkitRenderMode]);
```

The subscription effect must remain independent of `transcriptRenderMode`; a mode change must not bind duplicate RTC/RTM listeners or clear history.

- [ ] Rerun the hook test and API integration test:

```bash
npm test -- src/hooks/useConversationalAI.test.ts
npm test -- src/conversational-ai-api/index.test.ts
```

- [ ] Commit this slice:

```bash
git add src/hooks/useConversationalAI.ts src/hooks/useConversationalAI.test.ts
git commit -m "feat: apply transcript modes during active calls"
```

---

## Task 5: Add accessible Text, Word, and Auto tooltips

**Files:**

- Create: `src/components/TranscriptRenderModeControls.tsx`
- Create: `src/components/TranscriptRenderModeControls.test.tsx`
- Modify: `src/components/TranscriptSidePanel.tsx`

- [ ] Create the component test first. Render the controls with a stateful wrapper and assert:

  - buttons are discoverable by the names `Text — show complete transcript updates`, `Word — reveal words as spoken`, and `Auto — use word timing when available`;
  - the selected button exposes `aria-pressed="true"` and the others expose `false`;
  - all three tooltip strings are present with `role="tooltip"` and stable `aria-describedby` links;
  - clicking Word changes the pressed state through the supplied `onChange` contract.

- [ ] Run the focused test and verify RED because the extracted component does not exist:

```bash
npm test -- src/components/TranscriptRenderModeControls.test.tsx
```

- [ ] Implement a focused component with this public contract:

```ts
interface TranscriptRenderModeControlsProps {
  value: ETranscriptRenderMode;
  onChange: (mode: ETranscriptRenderMode) => void;
}
```

Use a small descriptor array for the three modes and icons. Each control wrapper must be `relative group`; each button must have `aria-label`, `aria-describedby`, and `aria-pressed`; each tooltip must use hover and keyboard-focus visibility classes such as:

```tsx
<span
  id={tooltipId}
  role="tooltip"
  className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max -translate-x-1/2 rounded bg-gray-950 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
>
  {label}
</span>
```

Place tooltips above or below the compact controls so they do not change document flow or block neighboring buttons. Preserve the existing selected/unselected Tailwind colors and icon sizes.

- [ ] Replace only the three inline buttons in `TranscriptSidePanel.tsx` with:

```tsx
<TranscriptRenderModeControls
  value={transcriptRenderMode}
  onChange={setTranscriptRenderMode}
/>
```

Keep the `Render Mode:` label and surrounding layout unchanged.

- [ ] Rerun the focused test and then the full suite:

```bash
npm test -- src/components/TranscriptRenderModeControls.test.tsx
npm test
```

- [ ] Commit this slice:

```bash
git add src/components/TranscriptRenderModeControls.tsx src/components/TranscriptRenderModeControls.test.tsx src/components/TranscriptSidePanel.tsx
git commit -m "feat: explain transcript render controls"
```

---

## Task 6: Verify the complete behavior and inspect it in the app browser

**Files:**

- Verify: all files changed by Tasks 1–5
- Update only if necessary: tests or implementation directly related to observed regressions

- [ ] Confirm the feature branch is clean except for intended feature files and review the diff against its base:

```bash
git status --short --branch
git diff c7b0471...HEAD --stat
git diff c7b0471...HEAD
```

- [ ] Run the complete automated verification from the isolated worktree:

```bash
npm test
npm run build
```

The build must finish without TypeScript errors. Record any pre-existing warning separately; do not call the feature complete if tests or build fail.

- [ ] Start the worktree's development server on an available local port. If port 3000 belongs to the main checkout, use port 3001 rather than stopping an unrelated server:

```bash
npm run dev -- --port 3001
```

- [ ] In the in-app browser, verify the rendered transcript panel:

  - Text, Word, and Auto controls retain the compact layout.
  - Hovering and keyboard-focusing each control exposes the correct tooltip.
  - Clicking each control changes its pressed/selected state.
  - During a real Agora call, Text shows complete transcript updates, Word progressively reveals agent words, and Auto follows Word only when timing metadata is present.
  - Changing modes does not clear prior messages or duplicate transcript entries.

If the embedded browser cannot establish WebRTC, report that limitation explicitly and rely on the deterministic `audio-pts` integration test for synchronization coverage; do not claim a live RTC check was completed.

- [ ] Stop only the development server process started for this worktree.

- [ ] Run final status and log checks:

```bash
git status --short --branch
git log --oneline --decorate -8
```

- [ ] If browser verification required a legitimate feature correction, first add a failing regression test, make the smallest fix, rerun `npm test` and `npm run build`, and commit it with a scoped message. Otherwise, leave the branch clean and ready for review.

## Completion Evidence

Before reporting completion, include:

- exact `npm test` pass counts;
- successful `npm run build` result;
- whether live Agora RTC browser verification succeeded or was unavailable;
- the feature branch name and commit list;
- confirmation that no push, merge, or main-branch rewrite occurred unless separately requested.
