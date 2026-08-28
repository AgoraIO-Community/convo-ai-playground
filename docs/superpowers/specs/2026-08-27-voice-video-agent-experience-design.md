# Voice and Video Agent Experience Design

**Date:** 2026-08-27

**Branch:** `feature/voice-video-agent-experience`
**Status:** Approved

## Goal

Give the call screen two explicit presentation modes while preserving one continuous Agora RTC/RTM and Conversational AI session:

- **Voice Agent** centers a refined, state-driven agent visualization and removes camera publication.
- **Video Agent** centers the local camera, keeps the complete call controls, and shows the agent avatar/video when available.

At the same time, make OpenAI model selection accurate for Agora-managed credentials and useful for OpenAI BYOK users, and replace the existing childish robot imagery with a coherent professional agent identity.

## Source Constraints

### Agora-managed OpenAI

Agora's OpenAI LLM documentation, updated 2026-08-06, is authoritative for managed mode:

`https://docs.agora.io/en/ai/models/llm/openai`

Managed mode must expose exactly these models:

- `gpt-4o-mini`
- `gpt-4.1-mini`
- `gpt-5-nano`
- `gpt-5-mini`

Managed mode keeps `credential_mode: "managed"`, `vendor: "openai"`, and does not expose or retain a user API key.

### OpenAI BYOK

OpenAI's current model catalog is authoritative for BYOK:

`https://developers.openai.com/api/docs/models`

The playground calls `https://api.openai.com/v1/chat/completions`, so its curated choices must be general text/image-input models whose model pages declare Chat Completions support. It must not mix in Realtime, transcription, speech, image-generation, moderation, or Codex-specialized models.

The curated BYOK list will include current general models suited to conversational use:

- GPT-5.6 family: `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`
- GPT-5.5 family: `gpt-5.5`, `gpt-5.5-pro`
- GPT-5.4 family: `gpt-5.4`, `gpt-5.4-pro`, `gpt-5.4-mini`, `gpt-5.4-nano`
- Compatible earlier families retained for existing accounts: `gpt-5.2`, `gpt-5.1`, `gpt-5`, `gpt-5-mini`, `gpt-5-nano`, `gpt-4.1`, `gpt-4.1-mini`, `gpt-4o`, `gpt-4o-mini`

Because model access varies by account and OpenAI can add aliases or snapshots after release, BYOK also provides a **Custom model ID** entry. Selecting it reveals a text field and persists that exact non-empty ID. Deprecated models currently shown by the playground (`gpt-4-turbo`, `gpt-3.5-turbo`) are removed from the curated list but remain usable through the custom entry when a user deliberately needs them.

## Approaches Considered

### 1. Explicit mode switch with a shared call session - selected

A `Voice Agent` / `Video Agent` segmented control changes presentation and camera publication without restarting the RTC channel or agent. This makes privacy behavior explicit and keeps transcripts and agent context continuous.

### 2. Infer the mode from camera state - rejected

This has less UI, but it makes a muted camera, a disabled camera, and an intentional voice-only experience indistinguishable. Users cannot predict whether changing mode will publish media.

### 3. Separate voice and video routes - rejected

Separate pages simplify each layout but create avoidable navigation, lifecycle, and state-transfer problems. They risk restarting or losing the active agent session and transcript.

## Call Stage Architecture

### Mode ownership

`VideoCallScreen` owns a session-local `callExperienceMode` with values `"voice" | "video"`. The initial mode is derived once from the existing camera state:

- camera currently published/enabled -> `video`
- camera muted/unpublished -> `voice`

The mode is not persisted across calls. Each new call derives a safe initial state from its actual media state rather than a stale saved preference.

### Switching to Voice Agent

1. Disable/unpublish the local camera through the existing Agora media hook.
2. Update the mode only after the camera operation succeeds.
3. Keep microphone, RTC channel, RTM connection, agent instance, transcript, chat, timer, and settings unchanged.
4. Remove the camera control from the voice-mode control row because the mode switch is the intentional route back to video.
5. If camera shutdown fails, remain in video mode and show the existing toast error pattern.

### Switching to Video Agent

1. Request/enable and publish the local camera through the existing Agora media hook.
2. Update the mode only after camera publication succeeds.
3. If browser permission is denied or no camera is available, remain in voice mode and show a useful toast.
4. Preserve the active agent and transcript throughout.

### Voice stage

Create a focused `VoiceAgentStage` component containing:

- one centered agent orb/glyph;
- the configured agent name;
- a concise state label;
- connection/transmission context without duplicating header badges;
- reduced-motion behavior for users with `prefers-reduced-motion`.

The visual direction is restrained real-time infrastructure rather than a character or robot: deep navy surface, cyan/blue spectral edge, soft concentric rings, and measured motion. It must not copy the ChatGPT orb.

Animation mapping:

- `connecting`: slow expanding halo and subdued label;
- `idle` or `silent`: near-static breathing glow;
- `listening`: inward ripple with a cool cyan edge;
- `thinking`: slow asymmetric orbital sweep;
- `speaking`: layered outward energy rings with slightly faster cadence;
- RTC data-stream mode without RTM states: calm connected pulse and no false speaking claim.

Animations use transforms and opacity on wrappers, not expensive layout properties. The component exposes an accessible text state through `aria-live="polite"`; motion is decorative and hidden from assistive technology.

### Video stage

The local camera is the primary centered surface. When the agent supplies an avatar video track, show local and agent video side-by-side on large screens and stacked on smaller screens. When the agent has no video track, show a compact `VoiceAgentStage` companion rather than the old full cyan robot tile.

The existing transcript remains a desktop side panel and mobile bottom sheet in both modes.

## Controls

Keep controls centered and stable across modes:

- Voice Agent: microphone, end call, start/stop agent, settings.
- Video Agent: microphone, camera, end call, start/stop agent, settings.
- Manual turn controls remain conditional exactly as today.

The mode selector lives in the call header so it is not confused with a media mute button. Buttons retain accessible labels, visible focus states, disabled/loading behavior, and existing action semantics.

## Professional Agent Identity

Create a reusable `AgentGlyph` component instead of using `MdSmartToy` or face-like robot artwork. The glyph uses a minimal waveform/radiating-signal geometry and supports compact, control, navigation, and stage sizes.

Use it consistently in:

- Start/stop agent control;
- AI Agent settings tab;
- voice-stage center;
- relevant agent configuration section headers.

Settings navigation uses one outlined icon family with consistent optical size and stroke weight. `AI Agent`, `Voice`, `MCP Server`, and `Telephony` labels stay on one line. On narrow settings panels, the tab row scrolls horizontally instead of wrapping labels. Active state uses the existing Agora cyan accent with a restrained background; inactive icons and labels share one muted color.

Accordion icons, badges, labels, and chevrons use a consistent alignment grid. This is a visual refinement only: settings fields, persistence, custom payload behavior, and telephony behavior are not changed.

## Component Boundaries

- `src/screens/VideoCallScreen.tsx`: owns mode and orchestrates layout.
- `src/components/CallExperienceModeSwitch.tsx`: accessible voice/video segmented control.
- `src/components/VoiceAgentStage.tsx`: state-driven voice presentation.
- `src/components/AgentGlyph.tsx`: reusable professional agent mark.
- `src/components/Controls.tsx`: mode-aware control visibility and existing actions.
- `src/components/AgentTile.tsx`: retains avatar-video playback and delegates non-video presentation to the new voice stage/glyph.
- `src/components/SettingsSidebar.tsx`: consistent navigation/icon styling.
- `src/components/AgentSettingsSidebar.tsx`: consistent section icon styling.
- `src/lib/agora/openAIModels.ts`: separates managed and BYOK catalogs and validates custom IDs.
- `src/lib/agora/managedProviders.ts`: consumes the managed catalog without broadening Agora-managed support.
- `src/types/agora.ts`: removes the stale inline OpenAI preset list and imports or consumes the new BYOK catalog.

No call lifecycle, transcript parsing, telephony, authentication, or server API contract changes are part of this feature.

## State and Data Flow

```text
Mode switch
  -> request Agora camera enable/disable
  -> media operation succeeds
  -> update callExperienceMode
  -> render VoiceAgentStage or Video stage

Agent toolkit/RTM state
  -> Zustand agentState
  -> VoiceAgentStage visual state + accessible label

Credential mode + OpenAI vendor
  -> managed: strict Agora catalog
  -> BYOK: current curated catalog or validated custom ID
  -> existing join-payload builder
```

## Error Handling

- A failed camera transition does not change the visible mode.
- Camera permission and device errors use concise user-facing toasts and leave the voice experience usable.
- An empty custom model ID blocks settings save with a validation message.
- A stored BYOK model no longer present in the curated catalog is represented as a custom model rather than silently replaced.
- Switching to managed mode normalizes unsupported models to Agora's managed default and removes BYOK credentials as it does today.

## Responsive and Accessibility Requirements

- Desktop preserves the 350px transcript panel and gives the stage the remaining width.
- Mobile retains the transcript bottom sheet and keeps all primary controls reachable without horizontal page overflow.
- The settings tab strip may scroll horizontally, but the page itself must not.
- Mode switch, controls, and settings tabs are keyboard operable and have explicit accessible names.
- Visual state changes never rely on color alone; labels remain present.
- `prefers-reduced-motion: reduce` disables continuous orbital/ripple animation and keeps a static state treatment.

## Testing

### Unit and component tests

- Managed OpenAI catalog contains exactly the four Agora-documented models.
- BYOK catalog contains the current curated Chat Completions models and excludes deprecated/unrelated model families.
- Custom BYOK model IDs persist and empty IDs fail validation.
- Stored unknown BYOK IDs reopen as custom values.
- Voice mode disables camera publication and hides the camera control.
- Video mode enables camera publication and shows the camera control.
- Failed media operations preserve the previous mode and surface an error.
- Mode changes preserve active agent state and transcript components.
- Voice-stage labels and animation variants map correctly to agent states.
- RTC-only transport does not claim listening/thinking/speaking state.
- Settings tab labels remain single-line and expose correct accessible names.
- Start/stop control uses the new glyph and retains loading/disabled behavior.

### Verification

- Run `npm test -- --run`.
- Run `npm run lint`.
- Run `npm run build`.
- Start the isolated worktree on port 3000 and verify desktop and mobile layouts in the browser.
- Verify camera permission denial, voice-to-video, video-to-voice, active-agent switching, avatar video, no-avatar fallback, RTM state animation, and reduced motion.

## Out of Scope

- Copying OpenAI/ChatGPT visual assets or animation exactly.
- Adding OpenAI Realtime models to the standard LLM pipeline.
- Dynamically calling OpenAI's `/v1/models` endpoint from the browser.
- Persisting voice/video presentation mode across calls.
- Changing Agora-managed model availability beyond Agora's documented list.
- Reworking transcript rendering, telephony, authentication, or agent lifecycle APIs.
