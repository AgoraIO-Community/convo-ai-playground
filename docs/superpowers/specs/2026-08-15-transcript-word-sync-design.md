# Transcript word synchronization design

## Goal

Provide audio-synchronized agent transcript rendering when Agora supplies both word timing metadata and RTC audio PTS events, without losing completed agent messages when PTS is unavailable.

## Dependency alignment

- Keep `agora-agent-client-toolkit` pinned to `2.9.0`, matching Agora's current Web toolkit installation documentation.
- Upgrade `agora-rtc-sdk-ng` from `4.23.4` to `4.24.3`, matching the official CLI-generated Next.js quickstart.
- Keep `agora-rtm` at `2.2.3`.

## Runtime behavior

The RTC module parameter `ENABLE_AUDIO_PTS_METADATA` remains enabled before the singleton RTC client is created.

The transcript adapter continues ingesting complete transcript payloads in toolkit TEXT mode so a missing PTS clock cannot strand an agent response. For WORD and AUTO selections, it tracks whether agent word metadata and a valid monotonic `audio-pts` value are both available:

- When both are available, reveal agent words whose `start_ms` is at or before the current PTS.
- Before PTS is available, retain the transcript snapshot while waiting for a bounded fallback interval instead of permanently disabling word timing on the first agent message.
- If the fallback interval expires without PTS, render the complete transcript text and remain in fallback mode for that toolkit session.
- TEXT mode renders complete transcript updates immediately and never waits for PTS.

User transcript identity continues to be determined from `metadata.object === "user.transcription"` and remapped to the local RTC UID.

## Lifecycle and cleanup

Only one fallback timer may exist per toolkit session. Session destruction must clear the timer, remove transcript/state/PTS listeners, unsubscribe, and destroy the toolkit singleton exactly once.

## Verification

Unit tests will cover:

- WORD mode waiting when word metadata arrives before PTS.
- WORD mode switching to timed reveal when PTS arrives during the wait.
- WORD mode falling back to complete text when PTS does not arrive.
- TEXT mode remaining immediate.
- Destroying a session cancels the pending fallback.

Then run the focused adapter tests, the complete Vitest suite, and the production build.
