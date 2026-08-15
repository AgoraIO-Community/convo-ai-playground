# Transcript Word Rendering Design

## Goal

Make the transcript render-mode controls functional while preserving the current
working RTC, RTM, chat, and transcript layout. In Word mode, agent transcript
text progressively reveals in sync with Agora audio timing metadata. Text mode
continues to show each received text update in full. Auto chooses Word only when
the required timing data is available and otherwise uses Text.

The three icon controls also expose clear hover and keyboard-focus tooltips:
"Text — show complete transcript updates", "Word — reveal words as spoken", and
"Auto — use word timing when available".

## Official Agora contract

The implementation follows Agora's current Web guidance:

- Configure `AgoraRTC.setParameter("ENABLE_AUDIO_PTS_METADATA", true)` before
  `AgoraRTC.createClient()`.
- `WORD` uses audio PTS metadata to synchronize words with speech.
- `TEXT` renders complete text updates without PTS synchronization.
- Word mode falls back to Text when the server does not provide word timing
  metadata.
- Transcript update events represent the complete history and replace the
  previous transcript state rather than being appended.

References:

- https://docs.agora.io/en/ai/build/transcripts#implementation
- https://docs.agora.io/en/api-reference/api-ref/conversational-ai/client-toolkit/web
- https://github.com/AgoraIO-Conversational-AI/agent-client-toolkit-ts/tree/main/packages/conversational-ai

## Scope

### Included

- Enable RTC audio PTS metadata before the singleton RTC client is created.
- Add real progressive word rendering to the existing local transcript toolkit.
- Make Text, Word, and Auto changes affect the active subscription without
  restarting the call or clearing transcript history.
- Fall back safely when `metadata.words` or usable PTS values are unavailable.
- Add accessible hover/focus tooltips and explicit accessible names to all three
  render-mode controls.
- Add focused unit/component tests and browser verification.

### Excluded

- Migrating back to the published toolkit package.
- Changing transcript card layout, chat behavior, agent lifecycle, or server
  payloads.
- Synthetic word timing based on character count or guessed speech duration.
- Adding a Chunk control. Chunk assembly remains an internal transport concern.

## Architecture and data flow

### RTC initialization

`src/hooks/useAgora.ts` configures `ENABLE_AUDIO_PTS_METADATA` immediately before
the first `AgoraRTC.createClient()` call. The client remains a module-level
singleton as it is today.

### Transcript controller

`SubRenderController` remains the owner of transcript assembly and gains an
explicit render-mode update method plus audio-PTS input. It keeps the canonical
full transcript item and derives the currently visible text for an in-progress
agent turn.

For Word mode, the controller reads timing entries from
`item.metadata.words`. As audio PTS advances, it reveals every word whose start
time has been reached and emits an updated complete-history snapshot. Timers or
listeners are scoped to the active turn and are cleared on completion,
interruption, unsubscribe, mode change, and destroy.

Text mode emits the incoming text unchanged. Auto selects Word for an agent turn
only when both word timing metadata and an audio PTS clock are available;
otherwise it selects Text. User transcript behavior is unchanged.

### Toolkit bridge

`ConversationalAIAPI` binds the RTC `audio-pts` event and forwards PTS updates to
`SubRenderController`. It exposes `setRenderMode(mode)` so the UI can update the
active controller without recreating the singleton or duplicating RTC/RTM event
listeners.

`useConversationalAI` observes the Zustand render mode and calls the toolkit
setter after initialization. Switching modes preserves completed history. When
Word is selected during an in-progress turn, the visible text is recalculated
from the latest known PTS rather than replaying old words from the beginning.

### Transcript controls

`TranscriptSidePanel` keeps the existing compact icon controls. Each button gets
an `aria-label`, `aria-pressed`, and a tooltip visible on both hover and keyboard
focus. The tooltip does not change layout or block adjacent controls.

## Failure and fallback behavior

- Missing or empty `words`: render the complete incoming text.
- Missing/invalid audio PTS: render the complete incoming text.
- Malformed word timing entry: ignore that entry without dropping the turn.
- Interrupted turn: stop scheduled rendering and preserve the text already
  revealed plus the turn's interrupted status.
- Completed turn: cancel remaining work and show the final complete transcript.
- Mode switch: cancel obsolete timers/listeners before deriving the new view.

No user-facing error is shown for a normal Word-to-Text fallback; Auto is
designed to make this fallback transparent.

## Testing

Tests are written before production changes and cover:

1. PTS metadata is enabled before RTC client creation.
2. Text mode emits complete incoming text.
3. Word mode reveals words at their Agora timing boundaries.
4. Auto chooses Word with timings and Text without timings/PTS.
5. Changing modes updates an active controller without resubscribing.
6. Completed and interrupted turns cancel pending word rendering.
7. Unsubscribe/destroy clears word-render resources.
8. Text, Word, and Auto controls expose accessible pressed state and tooltips.

The full Vitest suite, TypeScript/production build, and in-app browser checks run
before completion. Live word/audio synchronization is verified in a real Agora
call when the in-app browser can establish RTC; unit tests provide deterministic
PTS coverage when the embedded browser cannot initialize WebRTC.

## Acceptance criteria

- Word mode visibly reveals agent words progressively during speech when Agora
  supplies timing metadata.
- Text mode displays complete transcript updates.
- Auto uses progressive rendering when supported and otherwise matches Text.
- Changing modes during a call takes effect without clearing history or creating
  duplicate transcript events.
- All three controls explain themselves on hover and keyboard focus.
- No regression in chat, transcript ordering, completed messages, cleanup, or
  existing tests.
