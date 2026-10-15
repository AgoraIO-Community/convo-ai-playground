# Bilingual AI Teacher — implementation and verification

Branch: `feature/ai-teacher-finalize`. Implemented natively in the existing feature worktree; no separate deployment or internationalization dependency.

## Subsequent approved startup fixes (2026-10-15)

The user superseded the original persistence requirement: every fresh visit/reload now starts in Brazilian Portuguese. English is an in-memory choice for the current visit only. The old locale cookie is expired; no language is read from or written to localStorage, sessionStorage, or IndexedDB.

Teacher runtime ASR now explicitly uses BYOK Deepgram Nova-3, independent of stale saved credential mode. Teacher bootstrapping no longer opens the learner camera; normal video calls retain camera publishing.

The in-app browser exposed a native `setConfiguration` method that rejected even unchanged peer configuration. A pre-SDK capability probe marks only that broken optional API unavailable so Agora's existing fallback creates peers with their final configuration. Working browsers are not patched. Probe resources close, unrelated failures propagate, and no authentication, ICE policy, or encryption settings change. The earlier pre-creation SDK flag and field-merging attempts did not resolve the browser error and were removed.

Latest automated verification: **69 files / 338 tests passed**, and **production build passed**.

Live in-app test: agent invite returned 200/RUNNING, the RTC client reached CONNECTED, and the previous configuration exception no longer occurred in the fresh session. ASR/lesson events and live agent metrics arrived. However, the only remote agent participant reported no published audio/video, and the expected avatar participant never joined. No playable media element appeared. Audio and avatar playback are therefore **not verified**; upstream media publication remains unresolved despite zero reported live provider errors. Provider-side startup logs/credential/session availability need investigation before declaring the end-to-end demo ready.

The test call was ended. On the authenticated landing page, selecting English changed the UI and native drawing controls to English; reloading returned both to Brazilian Portuguese. At that checkpoint, these follow-up changes were local and had not been pushed.

Later user verification confirmed the demo worked after correcting the Agora API base URL: the local gateway rejected Deepgram, while the official Agora endpoint accepted it. This is user-reported end-to-end confirmation, not a replacement for the earlier recorded browser observations. At the user's request, classroom auto-start is temporarily disabled so settings can be edited; manual Start remains available. The avatar default remains Anam/Samira; no Kyra/Kiara change was made.

## Delivered

- Brazilian Portuguese (`pt-BR`) is the Teacher Mode default; English (`en-US`) is the other supported locale.
- Authenticated landing and stopped classroom sessions expose a labeled, accessible language picker. Locale persists in a validated cookie across refresh and OAuth navigation.
- Locale controls Teacher UI, metadata, preview labels, native Excalidraw controls, Deepgram Nova-3 language, greetings, host prompt, Lesson Director narration/board content, and deterministic classroom commands.
- Language changes are blocked throughout active/start/update/stop lifecycle states. A stopped-session switch cancels pending teaching, clears board/conversation, and renews the board session before applying the new profile. Old poll responses cannot draw into the new session.
- Samira, Anam, ElevenLabs voice/Flash 2.5, existing LLM policy, MCP servers, saved settings, and standard non-teacher UI remain preserved.
- Verification repairs prevent `Para que serve…` from stopping a lesson, preserve contextual questions like `Por quê?`, and prevent a translated heading from masking clearly wrong-language narration.
- Mobile landing preview no longer extends outside the viewport.

## Verification

- `npm test -- --pool=threads --maxWorkers=4`: **67 test files, 330 tests passed**.
- `npm run build`: **passed**, including Next production compilation and type validation.
- Application-only `tsc --noEmit`: **passed** using a temporary configuration excluding test fixtures.
- Repository-wide standalone `tsc --noEmit`: **57 existing errors in 10 unrelated test fixture files** remain. This is not a clean repository-wide static check; those unrelated fixtures were not changed.
- `git diff --check`: **passed**.
- Public browser smoke: Portuguese default landing and diagram, English cookie selection/reload, reset to Portuguese with cookie removal, and mobile preview bounds verified. At a 390px viewport the corrected preview measured x=25px, width=340px, right=365px.
- One fresh-context whole-feature review was completed. All four findings were addressed with regression tests; no deferred minor findings.

### Still requires authenticated live verification

Google sign-in/return, Portuguese ASR accuracy, ElevenLabs pronunciation, avatar playback, deployed Redis/session connectivity, and a live Portuguese-to-English lesson switch must be exercised in a signed-in browser. Payload/unit tests and public browser checks do not establish external-service health or spoken-language quality.

The existing `.env` points authentication to `http://localhost:3001`; the feature server is started on that port. Environment credentials were not changed. Work is committed locally; publishing, pushing, or merging requires a separate user instruction.

## Rulings made during execution, in order

1. Use only this plan's own scratch directory; preserve sibling `.superpowers` content. Reason: scratch ownership is plan-specific. Cost if wrong: no product impact, but scratch evidence would need reconstruction.
2. Test localized wording through persistence/runtime/planning/UI consumers rather than every static string individually. Reason: maintainable behavioral coverage. Cost if wrong: missed copy requires another UI correction.
3. Commit classroom locale plumbing with the guarded picker/reset task. Reason: those changes share one screen and form a coherent boundary. Cost if wrong: commit granularity only, no runtime divergence.
4. Renew the board session and ignore disposed polls when locale changes. Reason: cancelling a lesson alone cannot suppress a late durable event. Cost if wrong: one extra session request per switch.
5. Localize embedded Excalidraw controls and shorten the teacher badge. Reason: the full Portuguese experience includes native drawing controls, and long badges can cover them. Cost if wrong: compact copy or drawing controls may need visual tuning.
6. Treat untranslated transcript guidance and non-teacher document language as important review findings. Reason: both affect visible/accessibility behavior and compatibility. Cost if wrong: extra correction work, not a changed integration contract.
7. Validate substantial narration independently of topic/board text. Reason: Portuguese headings must not hide an English spoken lesson. Cost if wrong: conservative language detection can trigger an extra repair for mixed-language speech; short technical content remains allowed.
8. Leave live OAuth/audio/ASR/voice/avatar/deployed Redis claims unverified without a signed-in session. Reason: mocked payloads cannot verify provider health or pronunciation. Cost if wrong: a real service issue may only surface during live smoke testing.
9. Do not add cross-tab broadcast synchronization. Reason: approved persistence covers refresh/navigation/OAuth, not simultaneously open tabs. Cost if wrong: another tab keeps its previous language until refreshed.
10. Preserve existing teacher LLM, turn-detection, and interruption defaults. Reason: this is localization, not model migration. Cost if wrong: existing provider/model limitations remain.
11. Do not expand scope into unrelated TypeScript test-fixture repairs. Reason: those errors predate this feature; application-only type checking and production build isolate new feature regressions. Cost if wrong: repository-wide standalone TypeScript remains red until fixtures are repaired.
12. Send short contextual Portuguese questions (`Por quê?`, `Qual?`, `Quais?`) to planning. Reason: they can be complete follow-ups, unlike a subjectless opening stem. Cost if wrong: an ambiguous question may need clarification instead of being filtered.
13. Keep the landing preview aspect ratio on desktop only and bound mobile width. Reason: minimum height plus aspect ratio caused horizontal clipping. Cost if wrong: mobile uses a taller preview composition.

Deferred minors: none.
