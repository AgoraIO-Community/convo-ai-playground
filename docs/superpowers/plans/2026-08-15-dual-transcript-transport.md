# Dual Transcript Transport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the user's RTM preference, deliver transcripts through RTC data streams when RTM is disabled, and switch transcript render modes without losing history.

**Architecture:** A transport helper normalizes the agent's `enable_rtm` and `data_channel` pair. The call lifecycle conditionally owns a reactive RTM client while RTC remains mandatory, and the toolkit adapter accepts either transport. Render mode becomes mutable adapter state so React never destroys the toolkit session merely to change presentation.

**Tech Stack:** Next.js 15, React 19, Zustand, TypeScript, Vitest, `agora-rtc-sdk-ng@4.24.3`, `agora-rtm@2.2.3`, `agora-agent-client-toolkit@2.9.0`.

## Global Constraints

- Preserve all existing uncommitted toolkit migration and word-timing changes in the isolated `codex/transcript-word-rendering` worktree.
- Use `parameters.data_channel: "rtc"` when `advanced_features.enable_rtm` is false; never use `"datastream"`.
- RTC media, RTC `stream-message`, and RTC `audio-pts` remain available in both modes.
- RTM-only chat, image, interrupt, receipt, SAL, manual-turn, and reliable agent-state behavior must remain unavailable in RTC mode.
- Do not recreate the Agora toolkit singleton when only Word, Text, or Auto changes.
- Every production behavior change follows a failing-test-first RED/GREEN cycle.

---

### Task 1: Normalize and persist the selected transcript transport

**Files:**
- Create: `src/lib/agora/transcriptTransport.ts`
- Create: `src/lib/agora/transcriptTransport.test.ts`
- Modify: `src/store/useAppStore.tsx:245-258`
- Modify: `src/store/useAppStore.test.ts:45-56`
- Modify: `src/components/Controls.tsx:30-73,163-215,248-299`
- Modify: `src/components/Controls.test.ts:120-175`
- Modify: `src/components/SettingsSidebar.tsx:1981-1990,2245-2265`
- Create: `src/components/SettingsSidebar.test.tsx`

**Interfaces:**
- Produces: `getTranscriptTransport(settings): "rtc" | "rtm"`.
- Produces: `withTranscriptTransport(settings): AgentSettings`.
- Produces: `CustomJoinPayload = { name: string; properties: Record<string, unknown> }`.
- Produces: `withCustomPayloadTranscriptTransport(payload, fallback): CustomJoinPayload`.
- Consumers: Zustand storage, settings Apply, regular agent invite, custom-payload invite, and Task 2's connection selection.

- [ ] **Step 1: Write failing transport and store tests**

Add literal behavior cases:

```ts
expect(withTranscriptTransport({
  ...settings,
  advanced_features: { enable_rtm: false },
})).toMatchObject({
  advanced_features: { enable_rtm: false },
  parameters: { data_channel: "rtc" },
});

expect(withTranscriptTransport({
  ...settings,
  advanced_features: { enable_rtm: true },
})).toMatchObject({
  advanced_features: { enable_rtm: true },
  parameters: { data_channel: "rtm" },
});
```

Replace the store test that expects RTM to be forced with a test that sets
`enable_rtm: false` and asserts the stored settings remain false, the channel is
normalized to `"rtc"`, and `transcriptionMode` becomes `"rtc"`.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- src/lib/agora/transcriptTransport.test.ts src/store/useAppStore.test.ts
```

Expected: failures because the helper does not exist and the store still forces
RTM.

- [ ] **Step 3: Implement the transport helper and exact store behavior**

Implement the public contract:

```ts
export type TranscriptTransport = "rtc" | "rtm";

export function getTranscriptTransport(
  settings: Pick<AgentSettings, "advanced_features">,
): TranscriptTransport {
  return settings.advanced_features?.enable_rtm === false ? "rtc" : "rtm";
}

export function withTranscriptTransport(
  settings: AgentSettings,
): AgentSettings {
  const transport = getTranscriptTransport(settings);
  return {
    ...settings,
    advanced_features: {
      ...settings.advanced_features,
      enable_rtm: transport === "rtm",
    },
    parameters: {
      ...settings.parameters,
      data_channel: transport,
    },
  };
}
```

The custom-payload helper reads an explicit boolean from
`properties.advanced_features.enable_rtm`; when absent, it uses the selected
regular-settings transport. It writes the same boolean/channel pair back into
the payload.

Update `setAgentSettings` to store `withTranscriptTransport(settings)` and set
`transcriptionMode` from `getTranscriptTransport` instead of forcing RTM.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
npm test -- src/lib/agora/transcriptTransport.test.ts src/store/useAppStore.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 5: Write failing invite and Apply tests**

Change Controls expectations so a disabled regular setting reaches
`inviteAgent` as `enable_rtm: false`, `data_channel: "rtc"`, and sets
`transcriptionMode("rtc")`. Add the equivalent custom-payload case. Add or
extract a focused settings-content test proving Apply calls `onSave` with the
currently disabled value instead of only writing IndexedDB behind the parent.

- [ ] **Step 6: Run component tests and verify RED**

Run:

```bash
npm test -- src/components/Controls.test.ts src/components/SettingsSidebar.test.tsx
```

Expected: Controls still forces RTM and the embedded Apply path does not notify
its parent.

- [ ] **Step 7: Use normalized settings in both invite paths and Apply**

Remove `requireRtmSettings` and `requireRtmCustomPayload`. Normalize the regular
settings once before persistence/invite. Normalize custom payloads with the
regular setting as fallback. Rename `_onSave` to `onSave`; make Apply await
`onSave(settings)` so Controls persists, updates active state, and synchronizes
the custom preview through its existing callback.

- [ ] **Step 8: Run component tests and verify GREEN**

Run:

```bash
npm test -- src/components/Controls.test.ts src/components/SettingsSidebar.test.tsx
```

Expected: both transport branches and settings Apply pass.

- [ ] **Step 9: Commit the transport preference slice**

```bash
git add src/lib/agora/transcriptTransport.ts src/lib/agora/transcriptTransport.test.ts src/store/useAppStore.tsx src/store/useAppStore.test.ts src/components/Controls.tsx src/components/Controls.test.ts src/components/SettingsSidebar.tsx src/components/SettingsSidebar.test.tsx
git commit -m "feat: persist transcript transport preference"
```

---

### Task 2: Make the browser connection lifecycle support RTC-only calls

**Files:**
- Modify: `src/hooks/useAgora.ts:18-25,91-180,270-287`
- Modify: `src/hooks/useAgora.test.ts:1-180`
- Modify: `src/screens/CallBootstrapScreen.tsx:12-61`
- Modify: `src/screens/CallBootstrapScreen.test.ts:1-90`
- Modify: `src/components/Controls.tsx:105-225`
- Modify: `src/screens/VideoCallScreen.tsx:34-68`

**Interfaces:**
- Changes: `joinMeeting(session, enableRtm): Promise<void>`.
- Produces: `configureRtm(enabled): Promise<RTMClient | null>` for transport changes before an agent starts or restarts.
- Produces: a reactive `rtmClient` snapshot shared by every `useAgora()` consumer.
- Consumes: `getTranscriptTransport` from Task 1.

- [ ] **Step 1: Write failing RTC-only lifecycle tests**

Add tests showing:

```ts
await result.current.joinMeeting(session, false);
expect(mocks.RtmConstructor).not.toHaveBeenCalled();
expect(mocks.rtcClient.join).toHaveBeenCalledOnce();
expect(mocks.rtcClient.publish).toHaveBeenCalledOnce();
expect(result.current.rtmClient).toBeNull();
```

Retain the current RTM ordering test by calling `joinMeeting(session, true)`.
Add a transition test in which `configureRtm(true)` logs in/subscribes using the
active session and `configureRtm(false)` unsubscribes/logs out.

- [ ] **Step 2: Run the hook test and verify RED**

Run:

```bash
npm test -- src/hooks/useAgora.test.ts
```

Expected: `joinMeeting` ignores the boolean and always constructs RTM;
`configureRtm` is absent.

- [ ] **Step 3: Implement conditional and reactive RTM ownership**

Keep RTC initialization unchanged. Store the active `RtcSessionResponse` at
module scope for a bounded call lifetime. Extract idempotent helpers:

```ts
async function connectRtm(session: RtcSessionResponse): Promise<RTMClient>
async function disconnectRtm(): Promise<void>
async function configureRtm(enabled: boolean): Promise<RTMClient | null>
```

Use one in-flight promise to prevent duplicate login/logout from multiple React
consumers. Publish RTM client changes through `useSyncExternalStore`, so
`VideoCallScreen` rerenders when settings enable or disable RTM. Clear the
active session and reactive snapshot during call cleanup.

`joinMeeting(session, enableRtm)` records the session, creates media tracks,
calls `configureRtm(enableRtm)`, then joins/publishes RTC.

- [ ] **Step 4: Run the hook test and verify GREEN**

Run:

```bash
npm test -- src/hooks/useAgora.test.ts
```

Expected: RTC-only, RTM-enabled, transition, and cleanup tests pass.

- [ ] **Step 5: Write failing bootstrap and invite integration tests**

Make the bootstrap store fixture include persisted agent settings. Assert
`joinMeeting(session, false)` for RTC settings and `joinMeeting(session, true)`
for RTM settings. In Controls, assert `configureRtm(false)` occurs before an RTC
agent invite and `configureRtm(true)` occurs before an RTM invite.

- [ ] **Step 6: Run integration tests and verify RED**

Run:

```bash
npm test -- src/screens/CallBootstrapScreen.test.ts src/components/Controls.test.ts
```

Expected: bootstrap does not pass transport selection and Controls does not
synchronize the RTM connection.

- [ ] **Step 7: Wire persisted settings into bootstrap and agent invite**

Delay bootstrap until `agentSettings` is non-null (Providers hydrates it from
IndexedDB or supplies defaults). Pass the derived RTM boolean into
`joinMeeting`. Before inviting an agent, call `configureRtm` with the effective
regular/custom transport. Set `transcriptionMode` only after that preparation
succeeds. Keep active-agent transport changes restart-required; do not tear down
the transport underneath a running agent.

- [ ] **Step 8: Run integration tests and verify GREEN**

Run:

```bash
npm test -- src/screens/CallBootstrapScreen.test.ts src/components/Controls.test.ts
```

Expected: both modes prepare the correct client transport before agent start.

- [ ] **Step 9: Commit the connection lifecycle slice**

```bash
git add src/hooks/useAgora.ts src/hooks/useAgora.test.ts src/screens/CallBootstrapScreen.tsx src/screens/CallBootstrapScreen.test.ts src/components/Controls.tsx src/components/Controls.test.ts src/screens/VideoCallScreen.tsx
git commit -m "feat: support RTC transcript transport"
```

---

### Task 3: Initialize the toolkit without RTM when RTC data stream is selected

**Files:**
- Modify: `src/lib/agora/clientToolkitAdapter.ts:157-192,245-259`
- Modify: `src/lib/agora/clientToolkitAdapter.test.ts`
- Modify: `src/hooks/useConversationalAI.ts:15-124`
- Modify: `src/hooks/useConversationalAI.test.ts:10-110`

**Interfaces:**
- Changes: `StartAgoraClientToolkitOptions.rtmEngine` becomes optional/null.
- Preserves: `AgoraClientToolkitSession.chat()` defensive behavior through the
  hook's transport guard.
- Consumes: reactive `rtmClient` and `transcriptionMode` from Task 2.

- [ ] **Step 1: Write a failing RTC-only adapter test**

Initialize with `rtmEngine: null`, capture the toolkit init configuration, and
assert it has no `rtmConfig` property while still subscribing to the channel.
Drive a `TRANSCRIPT_UPDATED` event through the fake toolkit and assert the
normalized transcript reaches the callback.

- [ ] **Step 2: Run the adapter test and verify RED**

Run:

```bash
npm test -- src/lib/agora/clientToolkitAdapter.test.ts
```

Expected: the required RTM type/config prevents RTC-only initialization.

- [ ] **Step 3: Make RTM configuration conditional**

Change the option to `rtmEngine?: RTMEngine | null` and initialize with:

```ts
client = await provider.init({
  rtcEngine: options.rtcEngine,
  ...(options.rtmEngine
    ? { rtmConfig: { rtmEngine: options.rtmEngine } }
    : {}),
  renderMode: TranscriptHelperMode.TEXT,
  enableLog: options.enableLog ?? false,
});
```

In `useConversationalAI`, require an RTM client only when
`transcriptionMode === "rtm"`. RTC mode may start with `rtmClient === null`.
Keep `sendChatMessage` guarded by `transcriptionMode === "rtm"` and a live
session.

- [ ] **Step 4: Add a failing RTC-mode hook test, then implement the hook guard**

Render the hook with `transcriptionMode: "rtc"` and `rtmClient: null`. Verify it
starts a session with `rtmEngine: null`. Watch the test fail before relaxing the
guard, then implement the minimal condition.

- [ ] **Step 5: Run adapter and hook tests and verify GREEN**

Run:

```bash
npm test -- src/lib/agora/clientToolkitAdapter.test.ts src/hooks/useConversationalAI.test.ts
```

Expected: both RTM and RTC session initialization paths pass.

- [ ] **Step 6: Commit the optional-RTM toolkit slice**

```bash
git add src/lib/agora/clientToolkitAdapter.ts src/lib/agora/clientToolkitAdapter.test.ts src/hooks/useConversationalAI.ts src/hooks/useConversationalAI.test.ts
git commit -m "feat: receive transcripts over RTC data stream"
```

---

### Task 4: Switch render modes in place without losing transcript history

**Files:**
- Modify: `src/lib/agora/clientToolkitAdapter.ts:177-309`
- Modify: `src/lib/agora/clientToolkitAdapter.test.ts`
- Modify: `src/hooks/useConversationalAI.ts:42-124`
- Modify: `src/hooks/useConversationalAI.test.ts:25-150`

**Interfaces:**
- Adds: `AgoraClientToolkitSession.setRenderMode(mode): void`.
- Preserves: `latestHistory`, `latestPts`, timeout fallback, and cleanup within
  one session.

- [ ] **Step 1: Replace the restart expectation with a failing reuse test**

After delivering completed and in-progress transcript state, change the store
mode and assert:

```ts
expect(mocks.starts).toHaveLength(1);
expect(mocks.sessions[0].destroyed).toBe(false);
expect(mocks.sessions[0].renderModes).toEqual([
  ETranscriptRenderMode.WORD,
]);
expect(useAppStore.getState().transcriptItems).toEqual([completed]);
expect(useAppStore.getState().currentInProgressMessage).toEqual(inProgress);
```

- [ ] **Step 2: Run the hook test and verify RED**

Run:

```bash
npm test -- src/hooks/useConversationalAI.test.ts
```

Expected: the current effect destroys the first session and creates a second.

- [ ] **Step 3: Add failing adapter mode-transition tests**

Cover these literal transitions against stored history:

- Word/Auto to Text emits the full stored completed message immediately.
- Text to Word with usable PTS emits timed text without re-subscribing.
- Text to Word without PTS keeps the already-visible full text while waiting,
  then preserves full text on timeout.
- Destroy still cancels the pending fallback timer after any transition.

- [ ] **Step 4: Run the adapter test and verify RED**

Run:

```bash
npm test -- src/lib/agora/clientToolkitAdapter.test.ts
```

Expected: `setRenderMode` is absent.

- [ ] **Step 5: Implement mutable adapter render state**

Add `setRenderMode` to the returned session. On Text, clear the fallback timer,
set timing state to disabled, and emit full `latestHistory`. On Word/Auto,
re-evaluate agent word metadata and `latestPts`; activate timing when possible,
otherwise retain a visible full-text snapshot while scheduling the existing
fallback. Do not call toolkit `init`, `unsubscribe`, or `destroy`.

- [ ] **Step 6: Separate hook initialization from presentation changes**

Remove `transcriptRenderMode` from the session lifecycle dependencies. Keep its
latest value in a ref for async startup. Add a small effect that calls
`sessionRef.current?.setRenderMode(transcriptRenderMode)`. Immediately after a
new session resolves, apply the ref's current value so a mode change during
async initialization is not lost.

- [ ] **Step 7: Run adapter and hook tests and verify GREEN**

Run:

```bash
npm test -- src/lib/agora/clientToolkitAdapter.test.ts src/hooks/useConversationalAI.test.ts
```

Expected: one session survives mode changes and all transcript snapshots remain
visible.

- [ ] **Step 8: Commit the stable render-mode slice**

```bash
git add src/lib/agora/clientToolkitAdapter.ts src/lib/agora/clientToolkitAdapter.test.ts src/hooks/useConversationalAI.ts src/hooks/useConversationalAI.test.ts
git commit -m "fix: preserve transcript across render modes"
```

---

### Task 5: Align transport-aware UI and verify the complete feature

**Files:**
- Modify: `src/screens/VideoCallScreen.tsx:100-130`
- Modify: `src/components/TranscriptSidePanel.tsx:200-365`
- Create: `src/screens/VideoCallScreen.test.tsx`
- Test: existing component, hook, store, adapter, and build suites

**Interfaces:**
- Consumes: `transcriptionMode` as the authoritative active transport.
- Produces: accurate connection copy and disabled RTM-only interaction in RTC
  mode.

- [ ] **Step 1: Add a focused failing UI behavior test**

Render the transport-dependent surface in RTC mode and assert it shows
`Connected with Agora RTC`, `Transmission: RTC`, and no enabled chat sender.
Render RTM mode and assert it shows `Connected with Agora RTC + RTM` with chat
available.

- [ ] **Step 2: Run the UI test and verify RED**

Run the focused test file selected for the surface. Expected: the header is
currently hardcoded to RTC + RTM.

- [ ] **Step 3: Render connection copy from active transport**

Use `transcriptionMode` for the call header. Retain the existing
`canSendMessages`/`onSendMessage` checks in `TranscriptSidePanel`, including its
`Transcript only` explanation for RTC mode.

- [ ] **Step 4: Run the UI test and verify GREEN**

Run the focused UI test and confirm both branches pass.

- [ ] **Step 5: Run complete automated verification**

Run:

```bash
npm test
npm run build
git diff --check
npm ls agora-agent-client-toolkit agora-rtc-sdk-ng agora-rtm --depth=1
```

Expected: all tests pass, build exits 0, diff check is clean, toolkit is 2.9.0,
RTC is 4.24.3, and only the known `agora-rtm@2.2.3` exact-peer metadata warning
against RTC 4.24.3 may remain.

- [ ] **Step 6: Restart and smoke-test the isolated worktree server**

Start `npm run dev` from the worktree. Verify HTTP 200 and manually exercise:

1. RTM off persists after Apply and panel reopen.
2. Starting the agent shows `Transmission: RTC` and transcript messages arrive.
3. Chat is unavailable in RTC mode.
4. RTM on persists and restores chat/state behavior after agent restart.
5. Word/Text/Auto changes retain all transcript messages.

- [ ] **Step 7: Commit the UI and verification slice**

```bash
git add src/screens/VideoCallScreen.tsx src/components/TranscriptSidePanel.tsx
git commit -m "fix: reflect active transcript transport"
```
