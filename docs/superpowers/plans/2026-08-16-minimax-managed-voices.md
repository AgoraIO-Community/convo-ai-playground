# MiniMax Managed Voices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reliable six-option English/Hindi voice selector for Agora-managed MiniMax TTS and always emit a valid `voice_setting.voice_id`.

**Architecture:** Keep the managed MiniMax voice catalog beside the managed provider catalog so normalization, validation, and UI share one source of truth. The settings sidebar writes the selected ID into `tts.params.voice_setting.voice_id`; normalization preserves supported IDs and falls back to the documented default for missing or stale settings.

**Tech Stack:** TypeScript, React, Next.js, Vitest, Agora Conversational AI REST payloads

## Global Constraints

- Expose exactly three English and three Hindi MiniMax system voices.
- Default to `English_captivating_female1`.
- Keep the current `credential_mode: "managed"` payload; do not introduce deprecated `preset`.
- Do not change managed OpenAI TTS or BYOK provider behavior.
- Do not expose MiniMax cloned or account-specific voice IDs in managed mode.

---

### Task 1: Managed MiniMax voice catalog and normalization

**Files:**
- Modify: `src/lib/agora/managedProviders.ts`
- Test: `src/lib/agora/managedProviders.test.ts`

**Interfaces:**
- Produces: `MANAGED_MINIMAX_VOICES`, `DEFAULT_MANAGED_MINIMAX_VOICE_ID`, and normalization of `params.voice_setting.voice_id`.
- Consumes: Existing `normalizeManagedTTS(config, requestedVendor?)` and `TTSConfig`.

- [ ] **Step 1: Write failing catalog and normalization tests**

Add assertions that the catalog contains the six approved IDs, missing MiniMax voice settings receive `English_captivating_female1`, a supported Hindi voice survives normalization, and an unknown voice falls back to the default.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- --run src/lib/agora/managedProviders.test.ts`

Expected: FAIL because the voice catalog exports and MiniMax voice normalization do not exist.

- [ ] **Step 3: Implement the catalog and normalization**

Add the six `{ value, label, language }` entries and use a narrow helper to read `params.voice_setting`. For managed MiniMax, emit:

```ts
params.voice_setting = {
  ...existingVoiceSetting,
  voice_id: supportedVoiceId ?? DEFAULT_MANAGED_MINIMAX_VOICE_ID,
};
```

Preserve other documented `voice_setting` properties while replacing an unsupported `voice_id`.

- [ ] **Step 4: Run the focused test and verify success**

Run: `npm test -- --run src/lib/agora/managedProviders.test.ts`

Expected: PASS.

### Task 2: Managed MiniMax voice selector and payload regression coverage

**Files:**
- Modify: `src/components/SettingsSidebar.tsx`
- Modify: `src/lib/agora/joinPayload.ts`
- Test: `src/lib/agora/joinPayload.test.ts`

**Interfaces:**
- Consumes: `MANAGED_MINIMAX_VOICES` and `DEFAULT_MANAGED_MINIMAX_VOICE_ID` from Task 1.
- Produces: A required Voice control for managed MiniMax that stores `tts.params.voice_setting.voice_id`, plus payload-boundary normalization for older saved settings.

- [ ] **Step 1: Write a failing join-payload regression test**

Create a managed MiniMax fixture with no voice and assert `buildJoinProperties(...)` contains:

```ts
expect(properties.tts.params).toMatchObject({
  model: "speech-2.6-turbo",
  voice_setting: { voice_id: "English_captivating_female1" },
});
```

- [ ] **Step 2: Run the focused payload test and verify failure**

Run: `npm test -- --run src/lib/agora/joinPayload.test.ts`

Expected: FAIL because the existing payload boundary does not normalize managed MiniMax TTS.

- [ ] **Step 3: Add the sidebar selector**

In `buildJoinProperties`, call `normalizeManagedTTS` only when `credential_mode === "managed"` so persisted settings are safe even if the user never opens the selector. For `ttsManaged && selectedTTSVendor === "minimax"`, render a required `CustomSelect` immediately after Model. Map the six catalog entries to labels formatted as `Friendly Name — Language`, read the nested voice ID from `settings.tts.params.voice_setting`, and update it without losing other TTS params or other `voice_setting` properties. Add a help link to `https://platform.minimax.io/docs/faq/system-voice-id`.

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
npm test -- --run src/lib/agora/managedProviders.test.ts src/lib/agora/joinPayload.test.ts
npm run typecheck
npm run lint
```

Expected: all commands exit successfully.

- [ ] **Step 5: Commit the implementation**

```bash
git add src/lib/agora/managedProviders.ts src/lib/agora/managedProviders.test.ts src/components/SettingsSidebar.tsx src/lib/agora/joinPayload.ts src/lib/agora/joinPayload.test.ts
git commit -m "fix: configure managed MiniMax voices"
```
