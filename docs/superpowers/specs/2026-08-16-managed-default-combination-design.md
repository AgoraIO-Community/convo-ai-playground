# Managed Default Combination Design

## Goal

Make the recommended Agora-managed cascade the default when a user switches the agent from BYOK to managed credentials:

- ASR: Deepgram `nova-3`
- LLM: OpenAI `gpt-5-mini`
- TTS: MiniMax `speech-2.6-turbo`
- MiniMax voice: `English_captivating_female1`

All other models currently supported by Agora managed mode remain selectable.

## Behavior

The managed provider catalog changes the OpenAI default model from `gpt-4o-mini` to `gpt-5-mini`. Deepgram and MiniMax defaults remain unchanged.

When the user changes LLM credential mode from BYOK to managed, the UI selects OpenAI `gpt-5-mini`, even if the BYOK configuration used another model that is also accepted in managed mode. After entering managed mode, manually selecting `gpt-4o-mini`, `gpt-4.1-mini`, `gpt-5-nano`, or `gpt-5-mini` continues to work and is not reset during ordinary edits.

Existing saved managed configurations are preserved when loaded. The change does not silently rewrite a saved `gpt-4o-mini`, `gpt-4.1-mini`, or `gpt-5-nano` selection. The new default takes effect when entering managed mode or when normalization must replace a missing or unsupported managed model.

ASR and TTS switching behavior does not change. BYOK configuration, credentials, endpoints, and provider-specific parameters are unaffected.

## Implementation

Update the managed OpenAI catalog default in `src/lib/agora/managedProviders.ts`. Extend managed LLM normalization with an explicit requested-model input so the credential-mode transition can request `gpt-5-mini` without making normalization overwrite an already valid managed selection everywhere else.

Update `SettingsSidebar` to request the catalog default only during the BYOK-to-managed transition. Keep the existing normalization path for already-managed settings so user selections remain stable.

## Validation

Add regression coverage that proves:

1. The managed provider catalog advertises `gpt-5-mini` as the OpenAI default.
2. Missing or unsupported managed LLM models normalize to `gpt-5-mini`.
3. Entering managed mode from BYOK selects `gpt-5-mini`.
4. Explicitly selected supported managed models remain unchanged during normal normalization.
5. The existing complete test suite and lint checks still pass without new errors.

No live Agora agent will be started as part of automated verification because that creates an external session and may incur usage. The emitted settings and join payload will be verified through the existing test boundary.
