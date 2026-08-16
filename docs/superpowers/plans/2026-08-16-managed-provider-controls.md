# Managed Provider Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict each Agora managed ASR, LLM, and TTS settings section to the provider/model combinations supported by Agora while preserving the existing BYOK experience.

**Architecture:** Add a small `managedProviders` domain module containing the documented catalog, defaults, normalizers, and validators. Consume it from `SettingsSidebar` for mode-aware controls and from `validateAgentSettings` for payload-boundary protection. Keep the general provider presets unchanged for BYOK mode.

**Tech Stack:** TypeScript, React 18, Next.js 14, Vitest, Testing Library.

## Global Constraints

- Work only on `codex/convoai-v2-11-migration` in its existing isolated worktree.
- Managed ASR supports only Deepgram `nova-2` and `nova-3`.
- Managed LLM supports only OpenAI `gpt-4o-mini`, `gpt-4.1-mini`, `gpt-5-nano`, and `gpt-5-mini`.
- Managed TTS supports MiniMax `speech-2.6-turbo` and `speech-2.8-turbo`, plus OpenAI `tts-1`.
- Managed mode remains independently selectable for ASR, LLM, and TTS.
- Do not remove or restrict any BYOK provider.
- Do not expose provider URL or API-key inputs in managed mode.
- Preserve normal Agora App ID, App Certificate/token, and REST authentication requirements.

---

### Task 1: Managed provider catalog and normalization

**Files:**
- Create: `src/lib/agora/managedProviders.ts`
- Create: `src/lib/agora/managedProviders.test.ts`

**Interfaces:**
- Consumes: `AgentSettings`, `ASRConfig`, `LLMConfig`, `TTSConfig`, and vendor types from `src/types/agora.ts`.
- Produces: `MANAGED_ASR_PROVIDERS`, `MANAGED_LLM_PROVIDERS`, `MANAGED_TTS_PROVIDERS`, `normalizeManagedASR`, `normalizeManagedLLM`, `normalizeManagedTTS`, and `isSupportedManaged*` membership helpers.

- [ ] **Step 1: Write failing catalog and normalization tests**

```ts
expect(MANAGED_LLM_PROVIDERS.openai.models).toEqual([
  "gpt-4o-mini",
  "gpt-4.1-mini",
  "gpt-5-nano",
  "gpt-5-mini",
]);
expect(normalizeManagedLLM(groqConfig)).toMatchObject({
  credential_mode: "managed",
  vendor: "openai",
  params: { model: "gpt-4o-mini" },
});
expect(normalizeManagedTTS(openAIConfig)).toMatchObject({
  credential_mode: "managed",
  vendor: "openai",
  params: { model: "tts-1" },
});
expect(normalizeManagedASR(microsoftConfig)).toMatchObject({
  credential_mode: "managed",
  vendor: "deepgram",
  params: { model: "nova-3" },
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/lib/agora/managedProviders.test.ts`

Expected: FAIL because `managedProviders.ts` and its exports do not exist.

- [ ] **Step 3: Implement the typed catalog and pure helpers**

```ts
export const MANAGED_LLM_PROVIDERS = {
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-5-nano", "gpt-5-mini"],
  },
} as const;
```

Add equivalent literal catalogs for ASR and TTS. The normalizers must retain
non-credential settings, set `credential_mode: "managed"`, replace unsupported
provider/model selections with the documented default, set the documented
provider URL needed by the REST block, and remove stale `api_key`, key-bearing
parameters, and custom headers.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/lib/agora/managedProviders.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the domain module**

```bash
git add src/lib/agora/managedProviders.ts src/lib/agora/managedProviders.test.ts
git commit -m "feat: add managed provider catalog"
```

### Task 2: Validate managed settings at the payload boundary

**Files:**
- Modify: `src/lib/agora/joinPayload.ts`
- Modify: `src/lib/agora/joinPayload.test.ts`

**Interfaces:**
- Consumes: `isSupportedManagedASR`, `isSupportedManagedLLM`, and `isSupportedManagedTTS` from Task 1.
- Produces: `validateAgentSettings` errors with category-specific paths and codes for unsupported managed selections.

- [ ] **Step 1: Add failing validation tests**

```ts
expect(validateAgentSettings(settingsWithManagedGroq)).toMatchObject({
  valid: false,
  errors: expect.arrayContaining([
    expect.objectContaining({
      path: "llm",
      code: "managed_llm_provider_model",
    }),
  ]),
});
expect(validateAgentSettings(settingsWithManagedOpenAI)).toMatchObject({
  valid: true,
});
```

Add equivalent invalid and valid cases for ASR and TTS, plus a BYOK Groq case
that remains valid.

- [ ] **Step 2: Run the join-payload test and verify RED**

Run: `npm test -- src/lib/agora/joinPayload.test.ts`

Expected: FAIL because unsupported managed combinations are currently accepted.

- [ ] **Step 3: Add managed catalog validation**

Inside `validateAgentSettings`, validate only blocks whose
`credential_mode === "managed"`. Emit one error per invalid category and leave
all BYOK blocks unchanged.

- [ ] **Step 4: Run domain and validation tests and verify GREEN**

Run: `npm test -- src/lib/agora/managedProviders.test.ts src/lib/agora/joinPayload.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit validation**

```bash
git add src/lib/agora/joinPayload.ts src/lib/agora/joinPayload.test.ts
git commit -m "fix: validate managed provider combinations"
```

### Task 3: Make the sidebar credential-mode aware

**Files:**
- Modify: `src/components/SettingsSidebar.tsx`
- Modify: `src/components/SettingsSidebar.test.tsx`

**Interfaces:**
- Consumes: managed catalogs and normalizers from Task 1.
- Produces: provider/model selectors constrained by each category's credential mode, hidden provider credentials in managed mode, and restoration of the previous BYOK draft during the same sidebar session.

- [ ] **Step 1: Add failing sidebar behavior tests**

Render the real sidebar, expand the relevant section, select `Agora managed`,
and assert literal user-visible behavior:

```ts
expect(screen.getByRole("button", { name: "OpenAI" })).toBeInTheDocument();
expect(screen.queryByText("Groq")).not.toBeInTheDocument();
expect(screen.queryByLabelText("API Key")).not.toBeInTheDocument();
expect(screen.queryByLabelText("API URL")).not.toBeInTheDocument();
```

Add TTS assertions for MiniMax/OpenAI and ASR assertions for Deepgram. Add a
mode round-trip test that starts with Groq BYOK, switches to managed, switches
back to BYOK, applies settings, and observes that Groq and its model/URL are
restored through `onSaveAgentSettings`.

- [ ] **Step 2: Run the sidebar test and verify RED**

Run: `npm test -- src/components/SettingsSidebar.test.tsx`

Expected: FAIL because provider lists are not mode-aware and credential fields
are still rendered in managed mode.

- [ ] **Step 3: Implement mode handlers and BYOK draft refs**

Add one `useRef` draft per category. On a BYOK-to-managed transition, save the
current category settings and replace them with the corresponding normalized
managed settings. On a managed-to-BYOK transition, restore the draft or the
existing default configuration.

- [ ] **Step 4: Implement mode-aware controls**

Derive provider options and model options from the managed catalog only when
that category is managed. Hide LLM URL/API key, TTS API key and unsupported
provider-specific credential fields, ASR API keys, and raw provider parameter
JSON in managed mode. Keep prompt, language, managed model, and supported voice
configuration visible.

- [ ] **Step 5: Run the sidebar test and verify GREEN**

Run: `npm test -- src/components/SettingsSidebar.test.tsx`

Expected: PASS.

- [ ] **Step 6: Run the complete relevant suite**

Run: `npm test -- src/lib/agora/managedProviders.test.ts src/lib/agora/joinPayload.test.ts src/components/SettingsSidebar.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit the sidebar behavior**

```bash
git add src/components/SettingsSidebar.tsx src/components/SettingsSidebar.test.tsx
git commit -m "feat: constrain Agora managed settings"
```

### Task 4: Regression and production verification

**Files:**
- Modify only files required by failures attributable to Tasks 1-3.

**Interfaces:**
- Consumes: the completed managed-mode implementation.
- Produces: a verified feature branch ready for local browser testing and PR review.

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: all Vitest suites pass without new warnings or errors.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: Next.js production build completes successfully.

- [ ] **Step 3: Verify the worktree diff**

Run: `git diff --check && git status --short --branch`

Expected: no whitespace errors and no unintended uncommitted files.

- [ ] **Step 4: Restart the feature-branch development server on port 3000**

Run the existing project command with the main checkout's local environment
loaded and `AUTH_URL=http://localhost:3000`, then verify `/call` renders from
this worktree.

- [ ] **Step 5: Commit any verification-driven fixes**

```bash
git add <only-the-files-changed-by-a-verification-fix>
git commit -m "fix: complete managed settings verification"
```
