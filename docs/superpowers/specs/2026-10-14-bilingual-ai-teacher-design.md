# Bilingual AI Teacher Design

**Date:** 2026-10-14

**Branch:** `feature/ai-teacher-finalize`

**Status:** Approved in chat

## Goal

Support one AI Teacher experience in European Portuguese and US English without duplicating deployments or application flows. Portuguese (`pt-PT`) is the default for a new visitor. An authenticated learner may choose either language before starting a lesson, and may switch languages after stopping the live agent. The selected locale controls the complete classroom experience: interface copy, speech recognition, teacher prompt and greeting, lesson speech, blackboard text, intent recognition, status messages, and errors.

## Product Contract

### Default and authentication flow

- With no saved preference, `/` renders in European Portuguese.
- The unauthenticated landing page and Google sign-in call to action are Portuguese.
- Google authentication returns to `/`, not directly to `/classroom`.
- After authentication, the landing page displays a language picker with visible text and decorative symbols: `🇵🇹 Português` and `🇺🇸 English`.
- The selected locale survives page refreshes, navigation, and the Google OAuth round trip.
- If the learner has previously selected English, that saved preference wins over the Portuguese default.
- Entering the classroom starts the existing automatic teacher connection using the selected locale.

### Classroom switching

- The language picker remains visible in the classroom.
- It is enabled only while the agent is stopped or has not started.
- It is disabled while the agent is connecting, starting, running, recovering, or stopping.
- A runtime guard rejects language changes while the agent is active even if UI state becomes stale.
- Stopping the agent re-enables the picker.
- Selecting another language updates the interface immediately and clears the blackboard, transcript, pending lesson, saved clarification state, and other lesson context so languages cannot be mixed.
- The next start creates a fresh agent session with the complete configuration for the selected locale.
- The first release does not attempt to mutate ASR, TTS, or prompts on a running agent.

## Chosen Architecture

Use a typed locale-profile registry rather than a general localization framework or separate language deployments. The app has two locales and the configuration includes runtime behavior that ordinary translation dictionaries cannot express, including ASR settings, prompts, intent patterns, and Lesson Director instructions.

The locale layer is divided into focused units:

```text
src/locales/
├── types.ts             # Locale codes and profile interfaces
├── index.ts             # Registry, default, parser, and lookup helpers
├── pt-PT.ts             # European Portuguese profile
└── en-US.ts             # US English profile
```

Each profile satisfies a shared interface resembling:

```ts
type TeacherLocale = "pt-PT" | "en-US";

interface TeacherLocaleProfile {
  locale: TeacherLocale;
  htmlLang: TeacherLocale;
  label: string;
  symbol: string;
  messages: TeacherMessages;
  agent: {
    systemPrompt: string;
    greeting: string;
    failureMessage: string;
  };
  asr: {
    vendor: "deepgram";
    model: "nova-3";
    language: TeacherLocale;
  };
  lessonDirector: {
    localeInstruction: string;
    returnPhrase: string;
  };
  intents: TeacherIntentPatterns;
}
```

The exact message interface is derived from the teacher-facing strings used by the landing page, classroom loading and error states, controls, stage status, transcript controls, avatar states, and lesson-complete screen. Shared brand names and provider names remain shared constants rather than duplicated translation keys.

This structure allows another language to be added as one new validated profile. If the product later needs a translation-management system, translated UI messages may migrate to `next-intl` while behavioral agent profiles remain typed.

## Locale Persistence and Rendering

The selected locale is stored in a non-sensitive cookie named `ai_teacher_locale`. Valid values are exactly `pt-PT` and `en-US`; missing or invalid values resolve to `pt-PT`.

A locale provider receives the server-resolved initial locale and exposes:

```ts
interface TeacherLocaleContextValue {
  locale: TeacherLocale;
  profile: TeacherLocaleProfile;
  setLocale(locale: TeacherLocale): void;
}
```

The setter updates client state and the cookie. Server-rendered entry points read the same cookie so the initial HTML, metadata where applicable, and `<html lang>` agree with the client. This prevents an English-to-Portuguese hydration flash and preserves the selection through OAuth.

The locale cookie is a preference, not an authentication credential. It is not `HttpOnly`. It uses `Path=/`, `SameSite=Lax`, a one-year `Max-Age`, and `Secure` in production.

## Agent Runtime Configuration

The existing teacher runtime-default builder becomes locale-aware. Immediately before starting an agent, it resolves the selected profile and applies:

- the locale-specific teacher system prompt;
- localized greeting and temporary-failure message;
- Deepgram Nova-3 with `pt-PT` or `en-US`;
- the existing LLM model, reasoning effort, avatar, ElevenLabs voice, turn detection, interruption behavior, MCP configuration, RTM configuration, and other saved settings.

The locale layer must not overwrite unrelated saved settings. Samira remains the teacher identity, the selected Anam avatar remains unchanged, and the configured ElevenLabs voice and Flash 2.5 behavior remain unchanged. Portuguese is produced by sending European Portuguese text to the multilingual TTS pipeline.

The Portuguese system prompt uses European Portuguese vocabulary and explicitly requires European Portuguese responses. It retains the existing one-sentence acknowledgement contract and localized exact responses for new topics, follow-ups, continuation, pausing, clearing the board, and temporary failures.

## Lesson Director and Blackboard

The lesson API wire request accepts an optional string during migration, then normalizes it into a required internal locale before invoking the planner:

```ts
interface TeacherLessonRequestWire {
  question: string;
  mode: TeacherLessonMode;
  locale?: string;
  context: TeacherLessonContextItem[];
  boardSummary: string;
  parentTopic?: string;
}

interface ValidatedTeacherLessonRequest
  extends Omit<TeacherLessonRequestWire, "locale"> {
  locale: TeacherLocale;
}
```

The updated client sends the active locale for every lesson and clarification request. The server resolves a missing locale from an older client to `pt-PT`, rejects any present but unsupported locale, and invokes the planner only with a validated `TeacherLocale`.

The Lesson Director keeps its existing JSON operation contract and visual-quality rules. It adds a locale-specific instruction requiring all learner-facing fields to use the selected language:

- lesson `topic`;
- each cue's `speech`;
- standalone board `text`;
- shape and connector `label` values;
- recap and return phrases.

Internal `element_id` and `cue_id` values remain ASCII-safe implementation identifiers. Visible board content supports Unicode, including Portuguese diacritics such as `ç`, `ã`, `á`, and `é`. The existing 450 UTF-8-byte spoken-cue limit remains in force, so both profiles instruct the planner to keep cues concise.

Technical identifiers, code, equations, product names, and established English technical terms may remain unchanged when translating them would reduce accuracy. Surrounding explanations remain in the selected language.

## Localized Turn Interpretation

Language selection also controls deterministic client intents. The Portuguese profile recognizes natural European Portuguese variants for:

- continuing or resuming, such as `continua`, `continue`, and `pode continuar`;
- stopping or pausing, such as `pára`, `pare`, `espera`, and `aguarde`;
- clearing the board, such as `limpa o quadro`, `apaga o quadro`, and `recomeça`;
- replacing the topic, such as `muda de tema`, `novo tema`, and `em vez disso`;
- incomplete-question detection for common Portuguese question stems.

English behavior retains the current intent phrases. Text normalization remains Unicode-aware and accent-tolerant where doing so does not create false positives. Intent recognition is driven by the active profile rather than one combined multilingual regular expression.

## User Interface

All teacher-mode user-facing strings come from the active profile, including:

- landing page heading, description, feature pills, authentication and classroom calls to action;
- classroom preparation and connection failure screens;
- agent and blackboard status badges;
- transcript and classroom controls;
- avatar connection and fallback labels;
- retry, stop, start, clear, sign-out, and lesson-complete actions;
- localized errors generated by the Lesson Director hook.

The language picker is accessible by keyboard and screen reader. Flags are decorative; visible language names and selected state carry meaning. Disabled classroom state explains that the agent must be stopped before changing language.

The Portuguese copy uses European Portuguese forms, including `Iniciar sessão`, `A preparar a sua sala de aula`, `Entrar na sala de aula`, and `Aula concluída`. It avoids Brazilian Portuguese forms unless they are also natural in Portugal.

## State and Data Flow

```text
ai_teacher_locale cookie
        ↓
server-resolved initial locale
        ↓
TeacherLocaleProvider
   ├── localized UI messages
   ├── authentication return experience
   ├── agent runtime defaults
   │      ├── ASR language
   │      ├── system prompt
   │      └── greeting and failures
   ├── deterministic intent patterns
   └── lesson request locale
              ↓
       Lesson Director prompt
              ↓
 localized speech + localized board operations
```

Locale changes are atomic from the learner's perspective: update preference, clear lesson state, then allow a new localized session to start. The previous agent is never reused across languages.

## Error Handling

- Missing or invalid locale cookie: resolve to `pt-PT`.
- Missing translation key during development: fail visibly so incomplete profiles are caught.
- Unexpected missing copy in production: fall back to the corresponding Portuguese message and report a safe diagnostic.
- Locale change requested while the agent is active: leave state unchanged and present localized guidance to stop the agent first.
- Agent restart failure after a language change: retain the selected locale and offer localized Retry and Sign out actions.
- Unsupported lesson API locale: return a localized-safe validation error without invoking the planner.
- Planner produces an invalid lesson: retain the existing repair path; repair instructions include the required locale.
- Planner produces substantial learner-facing text in the wrong language: request one repair with an explicit locale violation before reporting a localized lesson error.

Logs contain locale codes and orchestration state only. They do not add learner text, generated lesson text, tokens, credentials, or provider secrets.

## Compatibility and Scope

- One Vercel deployment serves both locales.
- No locale prefix is added to URLs in this release.
- No new i18n runtime dependency is introduced.
- Existing authentication, Redis-backed teacher sessions, Weather MCP, Teacher MCP, avatar, voice configuration, normal Voice/Video modes, and saved provider settings remain functional.
- The feature applies to Teacher Mode surfaces. General non-teacher settings remain unchanged unless they are rendered inside the teacher classroom flow.
- Live in-session mutation of ASR or TTS is out of scope; switching requires a stopped agent and a fresh session.
- Automatic machine translation at runtime is out of scope.
- A dedicated native Portuguese ElevenLabs voice is out of scope; the current multilingual voice is retained and evaluated manually.

## Verification Strategy

Automated coverage verifies:

- locale parsing, defaulting, and profile completeness;
- cookie persistence and invalid-cookie fallback;
- runtime agent payloads for `pt-PT` and `en-US` without loss of unrelated saved settings;
- Portuguese and English deterministic intents;
- lesson API locale validation and propagation;
- Portuguese lesson parsing with accented speech and board labels;
- wrong-language repair behavior;
- language picker enabled and disabled states;
- authentication callback returning to the localized landing page;
- locale-change reset of board, transcript, pending lesson, and clarification context.

Manual smoke verification covers:

1. A new signed-out browser opens the Portuguese landing page.
2. Google sign-in returns to the Portuguese authenticated landing page.
3. A Portuguese lesson is heard, transcribed, and drawn in Portuguese.
4. Portuguese stop, continue, follow-up, and clear-board requests behave correctly.
5. The picker cannot change language while the agent runs.
6. After stopping, selecting English clears the lesson and changes the interface.
7. A newly started English lesson is heard, transcribed, and drawn in English.
8. Refreshing and signing in again preserve the last selected language.

## Acceptance Criteria

1. With no saved locale, all Teacher Mode surfaces render in European Portuguese.
2. Google authentication returns to the landing page, where an authenticated learner can select Portuguese or English before entering the classroom.
3. The learner's valid locale selection persists through refreshes, navigation, and OAuth.
4. Starting a Portuguese session configures Deepgram Nova-3 for `pt-PT`, uses Portuguese agent prompts and messages, and produces Portuguese speech, transcript content, Lesson Director speech, and visible blackboard text.
5. Starting an English session preserves the current English teacher behavior with English ASR, prompts, speech, intents, and board content.
6. The language picker is disabled throughout every active-agent lifecycle state and is re-enabled only after the agent is stopped.
7. Changing locale while stopped clears all previous lesson and transcript state before another session can start.
8. Portuguese commands for stop, continue, clear, follow-up, and topic replacement behave equivalently to their English counterparts.
9. Portuguese diacritics render correctly on the blackboard; internal IDs remain valid ASCII identifiers.
10. Existing avatar, ElevenLabs voice, LLM model, MCP, authentication, Redis session, and non-language saved settings are preserved.
