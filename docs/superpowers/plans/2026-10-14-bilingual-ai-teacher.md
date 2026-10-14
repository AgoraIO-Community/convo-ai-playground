# Bilingual AI Teacher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Teacher Mode default to Brazilian Portuguese while allowing authenticated learners to select English before a lesson or after stopping the live agent, with the selected locale controlling the UI, ASR, teacher prompt, speech, intents, and blackboard content.

**Architecture:** Add a dependency-free typed locale registry and cookie-backed React provider at the root layout. Resolve the active profile at each Teacher Mode boundary: UI components read localized messages, agent startup builds locale-specific runtime settings, and Lesson Director requests carry a validated locale through deterministic intent handling and server-side planning. A classroom picker is guarded by agent lifecycle state and resets the board and conversation before another localized session starts.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.8, Zustand 5, Zod 4, Vitest 4, Testing Library, Agora Conversational AI, Deepgram Nova-3, ElevenLabs Flash 2.5, Excalidraw.

**Spec:** `docs/superpowers/specs/2026-10-14-bilingual-ai-teacher-design.md`

## Global Constraints

- Supported locales are exactly `pt-BR` and `en-US`; `pt-BR` is the fallback and new-visitor default.
- Use one deployment and the existing routes; do not add locale URL prefixes or a new i18n dependency.
- Persist locale in `ai_teacher_locale` with `Path=/`, `SameSite=Lax`, one-year `Max-Age`, and `Secure` only in production.
- The language picker uses visible labels `🇧🇷 Português (Brasil)` and `🇺🇸 English`; flags are decorative.
- The picker is enabled only when the agent is fully stopped or has not started. Never mutate ASR, TTS, or prompts on a running agent.
- A locale change clears board, transcript, typed-message history, pending lesson, and clarification state before a new session starts.
- Portuguese means natural Brazilian Portuguese throughout UI, ASR, prompts, deterministic commands, speech, and blackboard content.
- Deepgram runtime settings are `vendor: "deepgram"`, `model: "nova-3"`, and language `pt-BR` or `en-US` matching the profile.
- Preserve Samira, the configured Anam avatar, ElevenLabs voice/Flash 2.5, LLM model, MCP servers, Redis-backed teacher sessions, turn detection, and unrelated saved settings.
- Internal `cue_id` and `element_id` values remain ASCII; learner-facing topic, speech, text, and labels support Unicode.
- Logs may include locale codes and orchestration state, never learner text, generated lesson text, tokens, credentials, or provider secrets.
- `.superpowers/` is unrelated untracked state and must not be staged or modified.

## Review Focus

- A malformed or stale locale cookie must fall back to `pt-BR` without a hydration mismatch; Task 1 tests invalid, missing, and valid cookies.
- A stale UI event must not switch locale while the agent is loading or active; Task 6 tests both the disabled control and runtime guard.
- A custom saved ASR provider must not leak incompatible params into the forced teacher Deepgram runtime config; Task 3 tests non-Deepgram input while preserving persisted settings.
- Short technical lessons may contain few language markers and must not be falsely rejected; Task 4 tests the minimum-token bypass and clearly wrong-language repair.
- Portuguese accents and longer UTF-8 encoding must survive planning while still enforcing the 450-byte cue limit; Task 4 tests accented board/speech content and the existing byte boundary.

---

### Task 1: Typed locale profiles, cookie parsing, and root provider

**Files:**
- Create: `src/locales/types.ts`
- Create: `src/locales/pt-BR.ts`
- Create: `src/locales/en-US.ts`
- Create: `src/locales/index.ts`
- Create: `src/locales/server.ts`
- Create: `src/locales/TeacherLocaleProvider.tsx`
- Create: `src/locales/index.test.ts`
- Create: `src/locales/server.test.ts`
- Create: `src/locales/TeacherLocaleProvider.test.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/providers.tsx`

**Interfaces:**
- Produces: `type TeacherLocale = "pt-BR" | "en-US"`, `DEFAULT_TEACHER_LOCALE`, `TEACHER_LOCALE_COOKIE`, `TeacherMessages`, `TeacherIntentPatterns`, and `TeacherLocaleProfile` from `src/locales/types.ts`.
- Produces: `parseTeacherLocale(value: unknown): TeacherLocale`, `getTeacherLocaleProfile(locale: TeacherLocale): TeacherLocaleProfile`, `serializeTeacherLocaleCookie(locale: TeacherLocale, secure: boolean): string`, and `TEACHER_LOCALE_PROFILES` from `src/locales/index.ts`.
- Produces: `readRequestTeacherLocale(): Promise<TeacherLocale>` from `src/locales/server.ts`.
- Produces: `TeacherLocaleProvider`, `useTeacherLocale(): TeacherLocaleContextValue`, and `TeacherLocaleContextValue { locale, profile, setLocale }`.
- Consumes: no product interfaces from later tasks.

- [ ] **Step 1: Write failing registry and cookie tests**

In `src/locales/index.test.ts`, assert that missing, empty, and unsupported values resolve to `pt-BR`; valid `pt-BR` and `en-US` remain unchanged; both profiles satisfy the same complete message shape; both expose localized metadata; and serialization emits the exact path, same-site, max-age, and production-only secure attributes.

- [ ] **Step 2: Run the locale registry test and verify failure**

Run: `npm test -- src/locales/index.test.ts`

Expected: FAIL because `src/locales` does not exist.

- [ ] **Step 3: Implement the locale types and profiles**

Create the four registry files. Keep them pure—no React or Next.js imports. Define nested message groups named `brand`, `landing`, `classroom`, `controls`, `stage`, `avatar`, `transcript`, `lesson`, and `callEnded`; include every Teacher Mode string currently hardcoded in the components listed in later tasks. Put agent prompt/greeting/failure, ASR values, Lesson Director locale instruction/return phrase, and locale-specific intent patterns in each profile. Preserve common product/provider names as shared constants.

- [ ] **Step 4: Run the locale registry test and verify it passes**

Run: `npm test -- src/locales/index.test.ts`

Expected: PASS for both complete profiles and all cookie cases.

- [ ] **Step 5: Write failing server-cookie and provider tests**

In `src/locales/server.test.ts`, mock `next/headers` and assert `readRequestTeacherLocale()` returns a valid cookie or `pt-BR` fallback. In `TeacherLocaleProvider.test.tsx`, assert initial rendering uses the server-provided locale, `setLocale("en-US")` updates consumer output, `document.documentElement.lang`, and the cookie, and an invalid value cannot enter context.

- [ ] **Step 6: Run the provider tests and verify failure**

Run: `npm test -- src/locales/server.test.ts src/locales/TeacherLocaleProvider.test.tsx`

Expected: FAIL because the server reader and provider do not exist.

- [ ] **Step 7: Implement server resolution and the React provider**

Implement `readRequestTeacherLocale()` using `await cookies()`. Implement the client provider with state initialized from `initialLocale`, a stable `setLocale`, cookie persistence, and `<html lang>` synchronization. Do not store locale in the agent-settings IndexedDB schema.

- [ ] **Step 8: Wire locale and metadata into the root layout**

Make `RootLayout` async, resolve the cookie once, set `<html lang={initialLocale}>`, and pass `initialLocale` to `Providers`. Replace static Teacher Mode metadata with `generateMetadata()` that resolves the same profile and returns its localized title and description. Update `Providers({ children, initialLocale })` to wrap its existing providers with `TeacherLocaleProvider` without changing settings hydration.

- [ ] **Step 9: Run focused tests and TypeScript**

Run: `npm test -- src/locales/index.test.ts src/locales/server.test.ts src/locales/TeacherLocaleProvider.test.tsx && npx tsc --noEmit`

Expected: all focused tests PASS and TypeScript exits 0.

- [ ] **Step 10: Commit the locale foundation**

```bash
git add app/layout.tsx app/providers.tsx src/locales
git commit -m "feat: add typed teacher locale profiles"
```

### Task 2: Localized authentication, landing, loading, and completion flow

**Files:**
- Create: `src/components/teacher/TeacherLanguagePicker.tsx`
- Create: `src/components/teacher/TeacherLanguagePicker.test.tsx`
- Create: `src/screens/TeacherHomeScreen.test.tsx`
- Modify: `src/screens/TeacherHomeScreen.tsx`
- Modify: `src/screens/TeacherDemoLandingScreen.tsx`
- Modify: `src/screens/TeacherDemoLandingScreen.test.tsx`
- Modify: `src/hooks/useTeacherBoardSession.ts`
- Modify: `src/lib/teacher/demoLesson.ts`
- Create: `src/lib/teacher/demoLesson.test.ts`
- Modify: `src/components/teacher/TeacherClassroomLoadingScreen.tsx`
- Modify: `src/components/teacher/TeacherClassroomLoadingScreen.test.tsx`
- Modify: `src/components/teacher/TeacherClassroomStateShell.tsx`
- Modify: `src/screens/CallEndedScreen.tsx`
- Modify: `src/screens/CallEndedScreen.test.ts`

**Interfaces:**
- Consumes: `useTeacherLocale()`, profile labels, and `TeacherMessages` from Task 1.
- Produces: `TeacherLanguagePickerProps { disabled?: boolean; disabledReason?: string; onRequestLocaleChange?(next: TeacherLocale): void }`.
- Produces: `getPhotosynthesisDemo(locale: TeacherLocale): TeacherCommandEvent[]` and `UseTeacherBoardSessionOptions.locale?: TeacherLocale`.
- Produces: authenticated landing behavior where locale selection is available and Google OAuth returns to `/`.

- [ ] **Step 1: Write failing picker tests**

Assert the picker exposes two radio-style choices with visible labels, decorative flags, selected state, keyboard accessibility, optional `onRequestLocaleChange`, and a disabled explanation. Verify it changes provider state only when enabled, and delegates without mutating context when the request callback is supplied.

- [ ] **Step 2: Run the picker test and verify failure**

Run: `npm test -- src/components/teacher/TeacherLanguagePicker.test.tsx`

Expected: FAIL because the picker does not exist.

- [ ] **Step 3: Implement `TeacherLanguagePicker`**

Build a compact segmented control backed by `useTeacherLocale`. Use `aria-label` from the current profile, `aria-pressed` or native radio semantics, and `title`/screen-reader copy for the disabled reason. When `onRequestLocaleChange` is supplied, delegate the request without mutating context; otherwise call the provider's `setLocale`. This lets the classroom reset lesson state before applying a new locale.

- [ ] **Step 4: Write failing home and landing tests**

Test that signed-out entry invokes `signIn("google", { callbackUrl: "/" })`; signed-in entry routes to `/classroom`; the picker is absent before authentication and present after authentication; Portuguese is the default landing copy; selecting English replaces the visible landing copy without navigation; and Google branding remains visible.

- [ ] **Step 5: Run home and landing tests and verify failure**

Run: `npm test -- src/screens/TeacherHomeScreen.test.tsx src/screens/TeacherDemoLandingScreen.test.tsx`

Expected: FAIL on the current `/classroom` OAuth callback and hardcoded English copy.

- [ ] **Step 6: Localize the home and landing experience**

Change the OAuth callback to `/`. Pass `showLanguagePicker={isAuthenticated}` to `TeacherDemoLandingScreen`. Replace all Teacher landing copy, errors, controls, preview labels, capability pills, and accessible labels with the active profile; keep Samira's existing preview image and board animation unchanged.

- [ ] **Step 7: Write and run failing localized demo tests**

In `demoLesson.test.ts`, assert the `pt-BR` preview contains `Fotossíntese`, `Luz solar`, `Água`, `Glicose`, and a Brazilian Portuguese energy note while `en-US` preserves the existing English labels. Update `useTeacherBoardSession` to select the demo by locale and restart the preview when locale changes.

Run: `npm test -- src/lib/teacher/demoLesson.test.ts src/screens/TeacherDemoLandingScreen.test.tsx`

Expected: FAIL because the demo is one English constant.

- [ ] **Step 8: Implement the locale-aware preview lesson**

Replace `PHOTOSYNTHESIS_DEMO` with `getPhotosynthesisDemo(locale)`, keeping coordinates, element IDs, timing, and operation structure identical across languages. Pass active locale from the landing caller into `useTeacherBoardSession`; Task 5 passes it from the live classroom when that screen begins consuming locale.

- [ ] **Step 9: Write and run failing loading/completion tests**

Extend existing tests to assert Brazilian Portuguese loading, retry, sign-out, lesson-complete, and start-another-lesson copy by default, plus English copy when wrapped with `initialLocale="en-US"`.

Run: `npm test -- src/components/teacher/TeacherClassroomLoadingScreen.test.tsx src/screens/CallEndedScreen.test.ts`

Expected: FAIL on hardcoded English strings.

- [ ] **Step 10: Localize loading, classroom shell, and lesson completion**

Read the active profile in `TeacherClassroomLoadingScreen`, `TeacherClassroomStateShell`, and the Teacher Mode branch of `CallEndedScreen`. Preserve the normal non-teacher call-ended copy and routes exactly as they are.

- [ ] **Step 11: Run all entry-flow tests and TypeScript**

Run: `npm test -- src/components/teacher/TeacherLanguagePicker.test.tsx src/screens/TeacherHomeScreen.test.tsx src/screens/TeacherDemoLandingScreen.test.tsx src/lib/teacher/demoLesson.test.ts src/components/teacher/TeacherClassroomLoadingScreen.test.tsx src/screens/CallEndedScreen.test.ts && npx tsc --noEmit`

Expected: all focused tests PASS and TypeScript exits 0.

- [ ] **Step 12: Commit the localized entry flow**

```bash
git add src/components/teacher/TeacherLanguagePicker.tsx src/components/teacher/TeacherLanguagePicker.test.tsx src/screens/TeacherHomeScreen.tsx src/screens/TeacherHomeScreen.test.tsx src/screens/TeacherDemoLandingScreen.tsx src/screens/TeacherDemoLandingScreen.test.tsx src/hooks/useTeacherBoardSession.ts src/lib/teacher/demoLesson.ts src/lib/teacher/demoLesson.test.ts src/components/teacher/TeacherClassroomLoadingScreen.tsx src/components/teacher/TeacherClassroomLoadingScreen.test.tsx src/components/teacher/TeacherClassroomStateShell.tsx src/screens/CallEndedScreen.tsx src/screens/CallEndedScreen.test.ts
git commit -m "feat: localize teacher entry experience"
```

### Task 3: Locale-aware Agora agent runtime configuration

**Files:**
- Modify: `src/constants/aiTeacherDefaults.ts`
- Modify: `src/constants/aiTeacherDefaults.test.ts`
- Modify: `src/components/Controls.tsx`
- Modify: `src/components/Controls.test.ts`

**Interfaces:**
- Consumes: `TeacherLocale`, `getTeacherLocaleProfile`, and `useTeacherLocale` from Task 1.
- Produces: `withAiTeacherRuntimeDefaults(settings: AgentSettings, locale: TeacherLocale): AgentSettings`.
- Produces: Teacher agent starts and settings comparisons using the current locale profile.

- [ ] **Step 1: Write failing runtime-profile tests**

Extend `aiTeacherDefaults.test.ts` to assert:

- `pt-BR` produces the Brazilian prompt, greeting, failure message, `asr.vendor === "deepgram"`, `asr.language === "pt-BR"`, and `asr.params` containing `model: "nova-3"` and `language: "pt-BR"`;
- `en-US` produces English equivalents and matching ASR language;
- a saved non-Deepgram ASR does not leak vendor-specific params into the teacher Deepgram runtime object;
- the source settings object is not mutated;
- LLM API key, LLM model policy, TTS, avatar, MCP servers, turn detection, and unrelated settings remain preserved according to current teacher defaults.

- [ ] **Step 2: Run runtime tests and verify failure**

Run: `npm test -- src/constants/aiTeacherDefaults.test.ts`

Expected: FAIL because the function does not accept locale and forces English prompt/ASR behavior.

- [ ] **Step 3: Refactor teacher defaults around the locale profile**

Change the function signature and remove English prompt ownership from this file. Build Deepgram runtime ASR from the profile; preserve reusable Deepgram credentials/url only when the saved vendor is already Deepgram, otherwise start with safe empty credential params. Do not persist the forced runtime ASR back into saved settings.

- [ ] **Step 4: Write failing Controls tests**

Wrap Controls with the locale provider and assert the invited teacher payload uses `pt-BR` by default and `en-US` when selected. Assert the saved `agentSettings` mock remains unchanged. Update existing button-label assertions to use the active localized Teacher Mode copy while preserving non-teacher English tests.

- [ ] **Step 5: Run Controls tests and verify failure**

Run: `npm test -- src/components/Controls.test.ts`

Expected: FAIL because Controls calls the runtime builder without locale.

- [ ] **Step 6: Apply locale at every teacher runtime boundary**

Read `locale` and `profile` once in Controls. Pass locale to the runtime builder for invite, settings comparison, and live update calculations. Replace Teacher Mode toasts and control labels with profile messages; leave normal voice/video mode copy unchanged.

- [ ] **Step 7: Run focused tests and TypeScript**

Run: `npm test -- src/constants/aiTeacherDefaults.test.ts src/components/Controls.test.ts && npx tsc --noEmit`

Expected: PASS, with both locales producing complete join settings.

- [ ] **Step 8: Commit locale-aware agent startup**

```bash
git add src/constants/aiTeacherDefaults.ts src/constants/aiTeacherDefaults.test.ts src/components/Controls.tsx src/components/Controls.test.ts
git commit -m "feat: localize teacher agent runtime"
```

### Task 4: Validated locale propagation and language enforcement in Lesson Director

**Files:**
- Modify: `src/types/teacher.ts`
- Create: `src/lib/teacher/lessonLocale.ts`
- Create: `src/lib/teacher/lessonLocale.test.ts`
- Modify: `app/api/teacher/lesson/route.ts`
- Create: `app/api/teacher/lesson/route.test.ts`
- Modify: `src/server/teacher/lessonPlanner.ts`
- Modify: `src/server/teacher/lessonPlanner.test.ts`
- Modify: `src/lib/teacher/lessonSchema.test.ts`

**Interfaces:**
- Consumes: `TeacherLocale`, `parseTeacherLocale`, and profile Lesson Director instructions from Task 1.
- Produces: `TeacherLessonRequestWire` with optional `locale?: string` and `ValidatedTeacherLessonRequest` with required `locale: TeacherLocale`.
- Produces: `assertTeacherLessonLocale(plan: TeacherLessonPlan, locale: TeacherLocale): void`.
- Changes: `PlanTeacherLessonInput` gains `locale: TeacherLocale`.

- [ ] **Step 1: Write failing locale-validator tests**

Test that a clearly English multi-sentence plan fails under `pt-BR`, a clearly Brazilian Portuguese plan fails under `en-US`, matching plans pass, short technical/equation plans under 16 alphabetic tokens bypass heuristic rejection, and Portuguese diacritics remain valid learner-facing text. Use distinct common-language marker counts rather than requiring every technical label to be translated.

- [ ] **Step 2: Run validator tests and verify failure**

Run: `npm test -- src/lib/teacher/lessonLocale.test.ts`

Expected: FAIL because the validator does not exist.

- [ ] **Step 3: Implement conservative wrong-language detection**

Collect `topic`, cue `speech`, operation `text`, and operation `label`. Normalize Unicode for comparison only. Skip detection below 16 alphabetic tokens. Reject only when the wrong-language marker set contains at least three distinct hits and the target-language marker set contains none; throw `TeacherLessonValidationError` so the existing single repair path is reused.

- [ ] **Step 4: Write failing lesson-route tests**

Mock auth, teacher-session authorization, rate limits, and `planTeacherLesson`. Assert missing locale normalizes to `pt-BR`, valid `en-US` propagates, and a present unsupported locale returns 422 without calling the planner.

- [ ] **Step 5: Run route tests and verify failure**

Run: `npm test -- app/api/teacher/lesson/route.test.ts`

Expected: FAIL because the route schema has no locale.

- [ ] **Step 6: Add the validated locale request contract**

Add request types to `src/types/teacher.ts`. Extend the Zod wire schema with optional locale, normalize missing to `pt-BR`, reject unsupported present values, and pass the required locale to `planTeacherLesson`. Include locale code in safe planner diagnostics.

- [ ] **Step 7: Write failing planner prompt and repair tests**

Assert the outbound OpenAI request includes `response_locale: "pt-BR"` plus the Brazilian locale instruction, the English request includes `en-US`, ASCII ID requirements remain explicit, an accented Portuguese plan parses successfully, and a clearly wrong-language first response triggers exactly one repaired request whose feedback names the locale violation.

- [ ] **Step 8: Run planner tests and verify failure**

Run: `npm test -- src/server/teacher/lessonPlanner.test.ts src/lib/teacher/lessonSchema.test.ts`

Expected: FAIL because planner input and prompt are locale-agnostic.

- [ ] **Step 9: Make planning locale-aware**

Add `locale` to planner input, inject `response_locale` and the profile's locale instruction into the user payload, call `assertTeacherLessonLocale` after schema parsing and layout normalization, and include the locale requirement in repair instructions. Keep the base visual-planning prompt, schema, cue limits, layout normalization, and quality rules unchanged.

- [ ] **Step 10: Run focused tests and TypeScript**

Run: `npm test -- src/lib/teacher/lessonLocale.test.ts app/api/teacher/lesson/route.test.ts src/server/teacher/lessonPlanner.test.ts src/lib/teacher/lessonSchema.test.ts && npx tsc --noEmit`

Expected: all locale propagation, repair, Unicode, and existing schema tests PASS.

- [ ] **Step 11: Commit localized lesson planning**

```bash
git add src/types/teacher.ts src/lib/teacher/lessonLocale.ts src/lib/teacher/lessonLocale.test.ts app/api/teacher/lesson/route.ts app/api/teacher/lesson/route.test.ts src/server/teacher/lessonPlanner.ts src/server/teacher/lessonPlanner.test.ts src/lib/teacher/lessonSchema.test.ts
git commit -m "feat: localize teacher lesson planning"
```

### Task 5: Locale-aware client intents and lesson orchestration

**Files:**
- Create: `src/lib/teacher/teacherIntents.ts`
- Create: `src/lib/teacher/teacherIntents.test.ts`
- Modify: `src/hooks/useTeacherLessonDirector.ts`
- Modify: `src/hooks/useTeacherLessonDirector.test.tsx`
- Modify: `src/screens/VideoCallScreen.tsx`
- Modify: `src/screens/VideoCallScreen.test.tsx`

**Interfaces:**
- Consumes: active `TeacherLocale`, locale intent patterns, return phrase, and lesson messages from Task 1.
- Produces: `normalizeLearnerText(value: string): string`, `isUnfinishedQuestionStem(value: string, locale: TeacherLocale): boolean`, and `classifyTeacherIntent(value: string, locale: TeacherLocale): "resume" | "clear" | "stop" | "replace" | null`.
- Changes: `UseTeacherLessonDirectorOptions` gains `locale: TeacherLocale`; every lesson request sends that locale.

- [ ] **Step 1: Write failing intent tests**

Cover English behavior unchanged and Brazilian phrases including `continue`, `pode continuar`, `pare`, `espere`, `limpe o quadro`, `apague o quadro`, `mude de assunto`, and incomplete stems such as `como funciona` without a subject. Test accented and unaccented equivalents where natural, plus negated stop phrases that must not pause.

- [ ] **Step 2: Run intent tests and verify failure**

Run: `npm test -- src/lib/teacher/teacherIntents.test.ts`

Expected: FAIL because intent logic is private and English-only.

- [ ] **Step 3: Extract and localize deterministic intent handling**

Move normalization, unfinished-stem detection, resume, clear, stop, and topic-replacement classification into the new pure module. Drive patterns from the chosen profile and preserve the existing duplicate-turn/fingerprint behavior in the hook.

- [ ] **Step 4: Write failing Lesson Director hook tests**

Update the hook test helper to provide locale. Assert a Portuguese request body includes `locale: "pt-BR"`; Portuguese stop/continue/clear routes to the same orchestration paths as English; return-to-main speech uses the localized phrase; and localized request failures reach the existing safe error state without a dev overlay.

- [ ] **Step 5: Run hook tests and verify failure**

Run: `npm test -- src/hooks/useTeacherLessonDirector.test.tsx`

Expected: FAIL because locale is absent from options and requests.

- [ ] **Step 6: Apply locale to the client Lesson Director**

Add locale to options and the request body, replace private English regexes with the pure intent module, replace `RETURN_PHRASE` and learner-facing errors with profile values, and keep cancellation, coalescing, clarification, resume, board acknowledgement, and speech timing unchanged.

- [ ] **Step 7: Pass locale through the classroom screen**

Read locale in `VideoCallScreen` and pass it to both `useTeacherLessonDirector` and `useTeacherBoardSession`. Update existing mocks/tests to prove the selected locale reaches lesson requests and the built-in board demo while normal voice/video behavior is unchanged.

- [ ] **Step 8: Run focused tests and TypeScript**

Run: `npm test -- src/lib/teacher/teacherIntents.test.ts src/hooks/useTeacherLessonDirector.test.tsx src/screens/VideoCallScreen.test.tsx && npx tsc --noEmit`

Expected: PASS for both languages and all existing orchestration tests.

- [ ] **Step 9: Commit localized turn handling**

```bash
git add src/lib/teacher/teacherIntents.ts src/lib/teacher/teacherIntents.test.ts src/hooks/useTeacherLessonDirector.ts src/hooks/useTeacherLessonDirector.test.tsx src/screens/VideoCallScreen.tsx src/screens/VideoCallScreen.test.tsx
git commit -m "feat: localize teacher turn handling"
```

### Task 6: Classroom picker, atomic reset, and remaining Teacher Mode copy

**Files:**
- Modify: `src/store/useAppStore.tsx`
- Modify: `src/store/useAppStore.test.ts`
- Modify: `src/screens/VideoCallScreen.tsx`
- Modify: `src/screens/VideoCallScreen.test.tsx`
- Modify: `src/components/Controls.tsx`
- Modify: `src/components/Controls.test.ts`
- Modify: `src/components/teacher/TeacherStage.tsx`
- Modify: `src/components/teacher/TeacherStage.test.tsx`
- Modify: `src/components/teacher/TeacherAvatarPiP.tsx`
- Modify: `src/components/teacher/TeacherAvatarPiP.test.tsx`
- Modify: `src/components/TranscriptDrawer.tsx`
- Modify: `src/components/TranscriptSidePanel.tsx`

**Interfaces:**
- Consumes: `TeacherLanguagePicker` from Task 2, locale context from Task 1, and localized Lesson Director cancellation from Task 5.
- Produces: `clearTeacherConversation(): void` in the Zustand store, resetting `transcriptItems`, `currentInProgressMessage`, `userSentMessages`, and Teacher Mode instruction history without modifying persisted agent settings.
- Produces: guarded classroom handler `handleTeacherLocaleChange(next: TeacherLocale): void` that resets teacher state before applying locale.

- [ ] **Step 1: Write failing store reset tests**

Seed transcript items, an in-progress item, typed user messages, and instruction entries. Assert `clearTeacherConversation()` clears those collections while preserving `agentSettings`, call identity, theme, and microphone selection.

- [ ] **Step 2: Run the store test and verify failure**

Run: `npm test -- src/store/useAppStore.test.ts`

Expected: FAIL because the targeted reset action does not exist.

- [ ] **Step 3: Implement the targeted conversation reset**

Add the action to `AppState` and the Zustand initializer. Do not replace `clearAgent`; keep agent lifecycle cleanup behavior intact.

- [ ] **Step 4: Write failing classroom-switch tests**

In `VideoCallScreen.test.tsx`, assert:

- the picker appears in the Teacher Mode header;
- it is disabled for `isAgentLoading`, `isAgentUpdating`, or `isAgentActive`;
- a stale locale-change callback while active leaves locale and lesson state unchanged and shows localized stop guidance;
- after stop, changing locale calls `lessonDirector.cancelLesson`, `teacher.clearBoard`, and `clearTeacherConversation` exactly once before changing context;
- English selection updates the header and remaining Teacher Mode copy;
- a subsequent Start agent action is available and uses Task 3's English configuration.

- [ ] **Step 5: Run classroom tests and verify failure**

Run: `npm test -- src/screens/VideoCallScreen.test.tsx`

Expected: FAIL because the classroom picker and reset handler do not exist.

- [ ] **Step 6: Implement the guarded classroom language switch**

Render `TeacherLanguagePicker` in the Teacher Mode header with `onRequestLocaleChange={handleTeacherLocaleChange}`. Disable it whenever loading, updating, active, or ending. In the callback, re-read current store state as a runtime guard; if active, do nothing except localized guidance. Otherwise cancel the lesson, pause the demo, clear board/conversation, close transcript UI, and only then call `setLocale(next)`. Do not auto-restart the agent.

- [ ] **Step 7: Write failing remaining-copy tests**

Extend component tests to assert Brazilian and English Teacher Mode labels for stage status, board controls, avatar fallback/status, transcript drawer, agent controls, timer title, and classroom header. Keep normal call labels unchanged.

- [ ] **Step 8: Run remaining-copy tests and verify failure**

Run: `npm test -- src/components/Controls.test.ts src/components/teacher/TeacherStage.test.tsx src/components/teacher/TeacherAvatarPiP.test.tsx src/screens/VideoCallScreen.test.tsx`

Expected: FAIL on remaining hardcoded Teacher Mode English strings.

- [ ] **Step 9: Complete Teacher Mode UI localization**

Replace only Teacher Mode-facing copy in the listed components with profile messages. For shared transcript components, accept optional localized labels from `VideoCallScreen` so normal Voice/Video modes keep current behavior. Preserve layout, avatar sizing, blackboard controls, transcript rendering, and accessibility semantics.

- [ ] **Step 10: Run the complete focused suite and TypeScript**

Run: `npm test -- src/store/useAppStore.test.ts src/screens/VideoCallScreen.test.tsx src/components/Controls.test.ts src/components/teacher/TeacherStage.test.tsx src/components/teacher/TeacherAvatarPiP.test.tsx && npx tsc --noEmit`

Expected: all classroom state, language lock, reset, and localized copy tests PASS.

- [ ] **Step 11: Commit classroom switching**

```bash
git add src/store/useAppStore.tsx src/store/useAppStore.test.ts src/screens/VideoCallScreen.tsx src/screens/VideoCallScreen.test.tsx src/components/Controls.tsx src/components/Controls.test.ts src/components/teacher/TeacherStage.tsx src/components/teacher/TeacherStage.test.tsx src/components/teacher/TeacherAvatarPiP.tsx src/components/teacher/TeacherAvatarPiP.test.tsx src/components/TranscriptDrawer.tsx src/components/TranscriptSidePanel.tsx
git commit -m "feat: add classroom language switching"
```

### Task 7: Full regression and bilingual smoke verification

**Files:**
- Modify only if verification exposes a defect in files already owned by Tasks 1–6.

**Interfaces:**
- Consumes: the completed bilingual feature.
- Produces: verification evidence; no new product interface.

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`

Expected: all Vitest suites PASS.

- [ ] **Step 2: Run static and production-build verification**

Run: `npx tsc --noEmit && npm run build`

Expected: TypeScript and Next.js production build exit 0.

- [ ] **Step 3: Start the feature worktree locally**

Run: `npm run dev`

Expected: the configured local port reports Ready and `/` loads without console errors.

- [ ] **Step 4: Smoke-test Brazilian Portuguese**

Use a clean browser cookie state. Verify Portuguese landing and Google CTA, authenticated picker, classroom preparation, Samira greeting, Deepgram understanding, Portuguese transcript, Portuguese Lesson Director speech, accented Portuguese blackboard labels, Portuguese stop/continue/clear commands, and disabled picker while the agent runs.

- [ ] **Step 5: Smoke-test the language switch and English session**

Stop the agent, select English, confirm the board/transcript reset and immediate UI change, start a new agent, and verify English ASR, greeting, lesson speech, diagram text, controls, and follow-up handling. Refresh and confirm English persists; clear the cookie and confirm the default returns to `pt-BR`.

- [ ] **Step 6: Review the final diff for preserved integrations**

Run: `git diff ec9deb7...HEAD --check && git status --short`

Expected: no whitespace errors, no credentials, no `.superpowers/` changes, and only the planned localization/runtime/test files plus the approved spec and plan.

- [ ] **Step 7: Commit verification-only repairs, if any**

If Steps 1–6 required a repair, stage only the owned files and commit:

```bash
git commit -m "fix: complete bilingual teacher verification"
```

If no repair was required, do not create an empty commit.
