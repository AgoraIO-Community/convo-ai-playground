# Dual Transcript Transport and Stable Render Modes

## Goal

Let users choose RTM or RTC data-stream transcript delivery, persist that
choice, and change transcript render modes during an active call without
losing transcript history.

## Decisions

- `advanced_features.enable_rtm: true` selects RTM delivery and
  `parameters.data_channel: "rtm"`.
- `advanced_features.enable_rtm: false` selects RTC data-stream delivery and
  `parameters.data_channel: "rtc"`.
- The selected transport is stored in IndexedDB with the other agent settings
  and remains authoritative when the settings panel is reopened.
- RTM-only actions are unavailable in RTC mode. The transcript remains visible,
  while chat, image messages, explicit interrupts, message receipts, SAL events,
  manual turn commands, and reliable agent-state events are disabled.
- Word, Text, and Auto changes update the active adapter in place. They do not
  destroy or recreate the Agora toolkit singleton and do not clear history.

## Architecture

### Settings and agent start

The Zustand store preserves the settings object exactly instead of rewriting
RTM fields. A small transport-normalization function produces the consistent
pair of `enable_rtm` and `data_channel` values before persistence and before an
agent is invited. The same normalization applies to the custom JSON payload.

The settings panel continues to expose the Enable RTM toggle. Apply persists
the normalized settings and updates the active store. Reopening the panel reads
the same value rather than a forced RTM value.

### Client connection lifecycle

RTC is always created, joined, and published. RTM is created, logged in, and
subscribed only when the saved preference enables RTM. The conversational AI
hook and adapter accept a nullable RTM client. When it is absent, the toolkit is
initialized without `rtmConfig`; the published toolkit still listens to the
RTC client's `stream-message` and `audio-pts` events.

The store's `transcriptionMode` mirrors the selected transport. Transcript UI
copy and control availability derive from this value.

### Render-mode switching

The adapter owns the latest complete toolkit history, latest audio PTS, and
word-timing state. Its session interface gains an in-place
`setRenderMode(mode)` method. Switching to Text immediately renders the full
stored history. Switching to Word or Auto re-evaluates the stored history and
PTS without hiding already-visible messages while it waits for timing data.

`useConversationalAI` initializes one session for the active RTC/channel/agent
lifecycle. A separate effect calls `session.setRenderMode()` when the UI mode
changes. Render mode is removed from the initialization effect dependencies.

## Error Handling

- If RTM setup fails while RTM is enabled, joining the call fails as it does
  today; the app does not silently change the user's transport preference.
- RTC data-stream mode does not attempt RTM chat operations. The UI disables
  those controls and the hook retains its defensive runtime guard.
- If audio PTS is unavailable, Word and Auto preserve the existing full-text
  fallback rather than removing transcript content.

## Tests

- Store tests prove `enable_rtm: false` and `data_channel: "rtc"` survive a
  settings update.
- Agent invite tests prove both regular and custom payloads use the selected
  transport pair instead of forcing RTM.
- Agora connection tests prove RTM login/subscription are skipped in RTC mode
  and retained in RTM mode.
- Adapter tests prove initialization works without RTM and receives RTC stream
  transcripts through the published toolkit.
- Hook tests prove render-mode changes reuse one session and call
  `setRenderMode` without clearing completed or in-progress transcript state.
- Existing word timing, timeout fallback, duplicate-message, and build tests
  remain green.

## Out of Scope

- Sending chat or interrupt commands over an alternative non-RTM protocol.
- Synthesizing agent-state events from audio activity in RTC mode.
- Changing Agora server APIs, credentials, token generation, or provider
  configuration.
