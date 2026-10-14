# Bilingual AI Teacher — implementation and verification

Branch: `feature/ai-teacher-finalize`. Implemented natively in the existing feature worktree; no separate deployment or internationalization dependency.

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
