# Agora Client Toolkit Migration Design

## Goal

Replace the copied `src/conversational-ai-api` implementation with
`agora-agent-client-toolkit@2.9.0` while preserving the Playground's transcript
UI, Text/Word/Auto controls, RTM chat, and agent-state display.

The published toolkit becomes the sole owner of RTC/RTM message parsing,
transcript assembly, interruption handling, and audio-PTS word scheduling.

## Why migrate

The copied renderer decides whether Word mode can run when the transcript first
arrives. In live calls the transcript can arrive before the remote audio track
publishes its first `audio-pts` event, so the copied code permanently falls back
to Text. It can also retire a turn when the transcript reports a final status,
even though the associated audio is still playing.

Toolkit 2.9.0 owns a PTS-driven rendering queue and is maintained alongside the
Agora transcript protocol. Keeping the local parser would duplicate that logic
and risk double transcript events.

## Architecture

### Toolkit boundary

Create a small app-owned adapter around `AgoraVoiceAI`. The adapter will:

- await asynchronous toolkit initialization;
- register events before subscribing to the channel;
- set the agent RTC UID used for speaker classification;
- replace Zustand transcript history from each full-history update;
- split completed and in-progress items for the existing store;
- map Agora agent states to the existing app enum;
- expose text and image sending with the existing UI-facing API;
- unsubscribe, detach listeners, and destroy the singleton during cleanup.

The adapter will not parse raw RTC or RTM transcript payloads or schedule words.

### Render modes

`ENABLE_AUDIO_PTS_METADATA` remains enabled before RTC client creation.

The toolkit is initialized with its documented render mode. The adapter maps the
Playground modes as follows:

- Text -> toolkit Text
- Word -> toolkit Word
- Auto -> toolkit Auto

If 2.9.0 does not provide an in-place render-mode setter, a mode change will
recreate only the toolkit subscription against the existing RTC/RTM clients.
The call and media tracks stay connected. Initialization is serialized so rapid
mode changes cannot leave duplicate subscriptions.

### RTM package

Toolkit 2.9.0 expects the `agora-rtm` package name. The app will use the same
package name for RTM client creation and toolkit integration so only one RTM SDK
instance is bundled.

### Removal

After the adapter and hook tests pass, delete `src/conversational-ai-api` and its
parser-specific tests. App-owned transcript/store types remain only where the UI
needs them.

## Error and lifecycle behavior

- Ignore stale async initialization after effect cleanup or a mode change.
- Clean up a partially initialized toolkit instance before surfacing an error.
- Treat every `TRANSCRIPT_UPDATED` payload as complete history; never append it.
- Preserve empty-history updates so a new session can clear old transcript data.
- Do not clear the RTC/RTM clients when changing only transcript render mode.
- Sending chat before initialization remains a no-op with a diagnostic message.

## Testing

Tests will cover:

1. Transcript normalization replaces full history and separates active turns.
2. Agent state and speaker metadata map to existing app types.
3. Initialization is awaited, listeners are installed before subscription, and
   cleanup removes the subscription.
4. Text, Word, and Auto map to the corresponding toolkit modes.
5. A render-mode change does not reconnect RTC/RTM and cannot duplicate toolkit
   listeners.
6. Existing PTS-before-RTC-client coverage remains green.
7. Text and image messages preserve their existing user-visible behavior.

The complete Vitest suite, production build, and a local browser call page are
verified before the change is ready to merge.

## Official references

- https://docs.agora.io/en/ai/build/transcripts#implementation
- https://docs.agora.io/en/api-reference/api-ref/conversational-ai/client-toolkit/web
- https://github.com/AgoraIO-Conversational-AI/agent-client-toolkit-ts/tree/main/packages/conversational-ai
