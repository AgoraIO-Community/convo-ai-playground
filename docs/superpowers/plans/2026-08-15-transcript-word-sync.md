# Transcript Word Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the Playground RTC SDK with the official quickstart and preserve true word timing when PTS begins shortly after the first agent transcript.

**Architecture:** Keep the toolkit in TEXT ingestion mode so complete transcript payloads are always available, while the adapter owns a small session-level state machine: waiting for PTS, word timing active, or text fallback. The adapter exposes only normalized completed/in-progress snapshots to the existing Zustand hook.

**Tech Stack:** Next.js 15, TypeScript, Vitest, `agora-agent-client-toolkit@2.9.0`, `agora-rtc-sdk-ng@4.24.3`, `agora-rtm@2.2.3`.

## Global Constraints

- Keep `agora-agent-client-toolkit` pinned to `2.9.0`.
- Upgrade `agora-rtc-sdk-ng` to `4.24.3`.
- Keep `agora-rtm` at `2.2.3`.
- Keep `ENABLE_AUDIO_PTS_METADATA` before `AgoraRTC.createClient()`.
- Never discard completed transcript text when PTS is unavailable.
- Clear every timer and SDK listener during session destruction.

---

### Task 1: PTS wait and fallback state machine

**Files:**
- Modify: `src/lib/agora/clientToolkitAdapter.test.ts`
- Modify: `src/lib/agora/clientToolkitAdapter.ts`

**Interfaces:**
- Consumes: `startAgoraClientToolkit(options, provider)` and RTC `audio-pts` events.
- Produces: unchanged `AgoraClientToolkitSession`; normalized snapshots switch to word timing only after valid PTS.

- [ ] **Step 1: Write failing tests**

Add fake-timer tests demonstrating these observable behaviors:

```ts
client.emit(AgoraVoiceAIEvents.TRANSCRIPT_UPDATED, [agentItem]);
expect(snapshots).toEqual([]);

rtcEngine.emit("audio-pts", 100);
expect(snapshots.at(-1)?.inProgress?.text).toBe("Hello");
```

Add separate tests proving that advancing the fallback timer emits the full text, TEXT mode emits immediately, and `session.destroy()` prevents a pending timer from emitting.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/lib/agora/clientToolkitAdapter.test.ts`

Expected: the new wait-before-fallback assertion fails because the current adapter emits full text and permanently disables word timing on the first transcript without PTS.

- [ ] **Step 3: Implement the minimal state machine**

In `startAgoraClientToolkit`, replace the early boolean lock with three states:

```ts
type WordTimingState = "disabled" | "waiting" | "active" | "fallback";
```

For WORD/AUTO agent messages containing valid `words`, enter `waiting` and schedule one fallback timer. A valid increasing `audio-pts` changes `waiting` to `active`, clears the timer, and emits a word-filtered snapshot. Timer expiry changes `waiting` to `fallback` and emits complete TEXT. TEXT begins in `disabled` and emits immediately.

- [ ] **Step 4: Ensure cleanup is complete**

Clear the fallback timer inside `destroy()` and remove the `audio-pts`, transcript, and state handlers before toolkit unsubscribe/destroy.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- src/lib/agora/clientToolkitAdapter.test.ts`

Expected: all adapter and toolkit-controller tests pass.

### Task 2: Align RTC dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: existing RTC SDK imports and `ENABLE_AUDIO_PTS_METADATA` setup.
- Produces: one resolved `agora-rtc-sdk-ng@4.24.3` dependency for the app and toolkit.

- [ ] **Step 1: Install the pinned RTC version**

Run: `npm install agora-rtc-sdk-ng@4.24.3 --save-exact`

- [ ] **Step 2: Verify the resolved dependency graph**

Run: `npm ls agora-agent-client-toolkit agora-rtc-sdk-ng agora-rtm --depth=1`

Expected: toolkit `2.9.0`, RTC `4.24.3`, and RTM `2.2.3`. The known RTM peer declaration may still report its historical `4.23.0` peer mismatch; the official quickstart also resolves RTM against RTC `4.24.3`.

### Task 3: Regression verification

**Files:**
- Verify only; no new production files.

**Interfaces:**
- Consumes: completed Tasks 1 and 2.
- Produces: evidence that transcript lifecycle, tests, and production compilation remain healthy.

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`

Expected: every Vitest test passes.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: Next.js production build completes successfully.

- [ ] **Step 3: Inspect the final diff**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors and only the planned source, tests, and dependency files remain modified.
