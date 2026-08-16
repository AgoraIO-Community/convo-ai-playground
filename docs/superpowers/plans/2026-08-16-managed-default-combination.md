# Managed Default Combination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Deepgram `nova-3`, OpenAI `gpt-5-mini`, and MiniMax `speech-2.6-turbo` the default combination when the user enters Agora-managed mode.

**Architecture:** Keep the managed provider catalog as the source of default model values. Extend the pure LLM normalizer so a credential-mode transition can explicitly request the catalog default while ordinary normalization continues preserving a supported user selection. Wire that explicit request only into the BYOK-to-managed UI transition.

**Tech Stack:** TypeScript, React, Next.js, Vitest, Testing Library

## Global Constraints

- Managed ASR remains Deepgram with `nova-3` as its default model.
- Managed LLM remains OpenAI; change only its default model from `gpt-4o-mini` to `gpt-5-mini`.
- Managed TTS remains MiniMax with `speech-2.6-turbo` and `English_captivating_female1` as defaults.
- Keep `gpt-4o-mini`, `gpt-4.1-mini`, `gpt-5-nano`, and `gpt-5-mini` selectable.
- Preserve existing saved managed model selections and all BYOK behavior.
- Do not start a live Agora agent during automated verification.
- Preserve unrelated worktree changes and commit the existing OpenAI TTS endpoint fix separately before changing the managed default.

---

### Task 1: Checkpoint the Existing Managed OpenAI TTS Endpoint Fix

**Files:**
- Modify: `src/lib/agora/managedProviders.ts`
- Test: `src/lib/agora/managedProviders.test.ts`
- Test: `src/lib/agora/joinPayload.test.ts`

**Interfaces:**
- Consumes: `normalizeManagedTTS(config, requestedVendor?)`
- Produces: managed OpenAI TTS payloads containing `params.url = "https://api.openai.com/v1/audio/speech"`

- [ ] **Step 1: Verify the focused endpoint tests**

Run:

```bash
npm test -- --run src/lib/agora/managedProviders.test.ts src/lib/agora/joinPayload.test.ts
```

Expected: 27 tests pass, including `adds the required endpoint to managed OpenAI TTS`.

- [ ] **Step 2: Verify the endpoint diff is isolated and formatted**

Run:

```bash
git diff --check
git diff -- src/lib/agora/managedProviders.ts src/lib/agora/managedProviders.test.ts src/lib/agora/joinPayload.test.ts
```

Expected: no whitespace errors; the production change only adds the OpenAI speech endpoint and the tests assert it.

- [ ] **Step 3: Commit the endpoint fix**

```bash
git add src/lib/agora/managedProviders.ts src/lib/agora/managedProviders.test.ts src/lib/agora/joinPayload.test.ts
git commit -m "fix: add managed OpenAI TTS endpoint"
```

### Task 2: Select GPT-5 Mini When Entering Managed Mode

**Files:**
- Modify: `src/lib/agora/managedProviders.ts:66-72,163-181`
- Modify: `src/components/SettingsSidebar.tsx:2218-2231`
- Test: `src/lib/agora/managedProviders.test.ts:57-124`
- Test: `src/components/SettingsSidebar.test.tsx:135-185`

**Interfaces:**
- Consumes: `MANAGED_LLM_PROVIDERS.openai.defaultModel`
- Produces: `normalizeManagedLLM(config: LLMConfig, requestedModel?: string): LLMConfig`
- UI behavior: `handleLLMCredentialModeChange("managed")` requests the catalog default exactly once during the transition.

- [ ] **Step 1: Write failing catalog and normalization tests**

Change the managed catalog expectation to:

```ts
expect(MANAGED_LLM_PROVIDERS.openai.defaultModel).toBe("gpt-5-mini");
```

Update the unsupported-model normalization expectation from `gpt-4o-mini` to `gpt-5-mini`, then add:

```ts
it("uses an explicitly requested supported managed LLM model", () => {
  const llm: LLMConfig = {
    credential_mode: "byok",
    vendor: "openai",
    url: "https://api.openai.com/v1/chat/completions",
    api_key: "secret",
    params: { model: "gpt-4o-mini" },
  };

  expect(normalizeManagedLLM(llm, "gpt-5-mini").params?.model).toBe(
    "gpt-5-mini",
  );
});
```

- [ ] **Step 2: Write the failing UI transition assertion**

In `shows only managed OpenAI models and hides LLM credentials`, immediately after choosing `Agora managed`, add:

```ts
expect(getSelectButton("Model")).toHaveTextContent("gpt-5-mini");
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
npm test -- --run src/lib/agora/managedProviders.test.ts src/components/SettingsSidebar.test.tsx
```

Expected: failures show the current catalog, normalizer, and UI still choose `gpt-4o-mini`. The tests must fail for this behavior difference, not for setup or syntax errors.

- [ ] **Step 4: Implement the catalog and normalization change**

Set the catalog default:

```ts
openai: {
  label: "OpenAI",
  defaultModel: "gpt-5-mini",
  models: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-5-nano", "gpt-5-mini"],
},
```

Change the normalizer signature and model selection:

```ts
export function normalizeManagedLLM(
  config: LLMConfig,
  requestedModel?: string,
): LLMConfig {
  const definition = MANAGED_LLM_PROVIDERS.openai;
  const candidateModel = requestedModel ?? config.params?.model;
  const model = supportsModel(definition, candidateModel)
    ? candidateModel
    : definition.defaultModel;
```

Keep the remainder of the function unchanged so credentials are still removed and supported models are preserved when no explicit model is requested.

- [ ] **Step 5: Wire the default into the credential-mode transition**

Change only the BYOK-to-managed branch in `handleLLMCredentialModeChange`:

```ts
llm: normalizeManagedLLM(
  prev.llm,
  MANAGED_LLM_PROVIDERS.openai.defaultModel,
),
```

Do not change the already-managed provider handler; its call without `requestedModel` must continue preserving the selected model.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
npm test -- --run src/lib/agora/managedProviders.test.ts src/components/SettingsSidebar.test.tsx
```

Expected: both files pass, including the new `gpt-5-mini` catalog, normalization, and UI-transition assertions.

- [ ] **Step 7: Run complete verification**

Run:

```bash
npm test -- --run
npm run lint
git diff --check
```

Expected: all tests pass; lint exits successfully with no new warnings; no whitespace errors.

- [ ] **Step 8: Review the final behavior diff**

Run:

```bash
git diff -- src/lib/agora/managedProviders.ts src/lib/agora/managedProviders.test.ts src/components/SettingsSidebar.tsx src/components/SettingsSidebar.test.tsx
```

Expected: the diff changes the managed OpenAI default and the BYOK-to-managed transition only. It does not remove models, change ASR/TTS defaults, alter BYOK credentials, or rewrite saved settings.

- [ ] **Step 9: Commit the managed default change**

```bash
git add src/lib/agora/managedProviders.ts src/lib/agora/managedProviders.test.ts src/components/SettingsSidebar.tsx src/components/SettingsSidebar.test.tsx
git commit -m "feat: default managed LLM to GPT-5 Mini"
```
