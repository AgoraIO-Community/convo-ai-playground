# Managed Provider Controls Design

## Goal

Make Agora managed mode easy and safe to configure by showing only the ASR,
LLM, and TTS provider/model combinations that Agora currently supports, while
leaving the full BYOK configuration experience unchanged.

## Source of truth

The supported combinations come from Agora's current managed-mode reference:

<https://docs.agora.io/en/ai/build/custom-model-integration/managed-mode>

| Category | Provider | Models |
| --- | --- | --- |
| ASR | Deepgram | `nova-2`, `nova-3` |
| LLM | OpenAI | `gpt-4o-mini`, `gpt-4.1-mini`, `gpt-5-nano`, `gpt-5-mini` |
| TTS | MiniMax | `speech-2.6-turbo`, `speech-2.8-turbo` |
| TTS | OpenAI | `tts-1` |

Managed mode may be enabled independently for ASR, LLM, and TTS. A category
that remains in BYOK mode retains its existing provider, credentials, and
provider-specific configuration.

## Architecture

Create a focused managed-provider module that owns the supported catalog,
defaults, normalization helpers, and membership checks. The settings sidebar
and join-settings validation will consume this module so the UI cannot drift
from the payload rules.

The existing general provider presets remain the source for BYOK choices. The
new managed catalog is deliberately separate because the REST API supports
more providers than Agora managed mode does.

## Sidebar behavior

Each ASR, LLM, and TTS section keeps its independent credential-mode selector.

When a category changes to `managed`:

- its provider dropdown shows every supported managed provider for that
  category;
- its model dropdown shows every supported managed model for the selected
  provider;
- an unsupported current selection is normalized to the category's default;
- provider API URL, API key, and custom provider-parameter JSON controls are
  hidden because Agora supplies credentials and endpoint configuration;
- supported non-credential controls remain available, including LLM prompts,
  ASR language, and TTS voice settings where the selected provider supports
  them.

The managed defaults are:

- ASR: Deepgram `nova-3`;
- LLM: OpenAI `gpt-4o-mini`;
- TTS: MiniMax `speech-2.6-turbo`.

When a category changes back to `byok`, the sidebar restores the category's
previous BYOK configuration from the current sidebar session. If no previous
BYOK draft exists, it uses the existing application default for that category.
The full existing BYOK provider and model lists then become available again.

## Payload behavior

Managed payload blocks continue to include `credential_mode: "managed"`, the
selected supported provider, and the selected model. They do not require the
user to enter provider credentials.

The existing server behavior that avoids injecting environment API keys into
managed blocks remains unchanged. Normalization removes stale provider
credentials and replaces any BYOK URL with the canonical endpoint for the
selected managed provider. These endpoint details stay behind the UI and are
not editable in managed mode.

## Validation and errors

`validateAgentSettings` rejects a managed category when either its provider or
model is outside the managed catalog. This protects saved legacy settings and
custom JSON paths that can bypass the sidebar controls.

Validation reports the exact category and explains which managed combinations
are accepted. BYOK settings are not subject to the managed catalog.

## Testing

Tests will cover observable behavior:

- switching each category to managed mode selects a valid default;
- managed provider/model controls expose only the documented combinations;
- managed mode hides provider key and endpoint controls;
- switching back to BYOK restores the previous BYOK configuration;
- validation accepts all documented managed combinations and rejects
  unsupported providers or models;
- existing BYOK and join-payload tests remain green.

## Non-goals

- Changing Agora App ID, App Certificate, RTC token, or REST authentication.
- Removing any BYOK provider.
- Adding providers or models not listed in the current managed-mode reference.
- Changing the API route's existing environment-key injection behavior beyond
  ensuring managed settings do not carry stale provider credentials.
