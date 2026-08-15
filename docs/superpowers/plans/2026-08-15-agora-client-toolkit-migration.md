# Agora Client Toolkit Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the copied transcript toolkit with `agora-agent-client-toolkit@2.9.0` and keep the Playground's Text, Word, Auto, chat, and agent-state behavior.

**Architecture:** A thin app adapter owns lifecycle and data mapping. The Agora package owns protocol parsing and PTS rendering. The React hook owns one active adapter instance and recreates that subscription only when a toolkit configuration such as render mode changes.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.8, Zustand 5, Agora RTC Web, Agora RTM, Agora Agent Client Toolkit 2.9.0, Vitest.

---

## Task 1: Capture the adapter contract with failing tests

**Files:**

- Create: `src/lib/agora/clientToolkitAdapter.test.ts`
- Create: `src/lib/agora/clientToolkitAdapter.ts`

- [ ] Write a transcript-normalization test using complete toolkit-shaped history.
- [ ] Prove the expected split into completed and in-progress app items.
- [ ] Cover empty history and speaker UID preservation.
- [ ] Run the focused test and observe RED because the adapter does not exist.
- [ ] Implement only the pure normalization needed for GREEN.
- [ ] Run the focused test and commit the slice.

## Task 2: Install and inspect the official 2.9.0 API

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/lib/agora/clientToolkitAdapter.test.ts`
- Modify: `src/lib/agora/clientToolkitAdapter.ts`

- [ ] Install exact `agora-agent-client-toolkit@2.9.0` and the supported `agora-rtm` package.
- [ ] Inspect the installed declarations for init config, events, transcript types,
  chat methods, cleanup, and render-mode capabilities.
- [ ] Add failing lifecycle and render-mode mapping tests against the real public
  type shapes while mocking only the browser/network singleton.
- [ ] Implement async init, listener-before-subscribe ordering, cleanup, state
  mapping, and chat forwarding.
- [ ] Run focused tests and commit the slice.

## Task 3: Migrate the React hook

**Files:**

- Modify: `src/hooks/useConversationalAI.test.ts`
- Modify: `src/hooks/useConversationalAI.ts`

- [ ] Rewrite the hook test around the app adapter and observe RED.
- [ ] Test stale async initialization cleanup and mode-change lifecycle.
- [ ] Replace copied-toolkit imports with the adapter.
- [ ] Keep store actions behind stable callbacks/refs to avoid duplicate event
  subscriptions on ordinary React renders.
- [ ] Preserve text/image sending and local user-message echo behavior.
- [ ] Run hook and adapter tests and commit the slice.

## Task 4: Unify the RTM dependency

**Files:**

- Modify: `src/hooks/useAgora.ts`
- Modify: `src/hooks/useAgora.test.ts`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`

- [ ] Change the RTM import and test mock to `agora-rtm`.
- [ ] Keep RTM identity, login, channel subscription, and cleanup behavior intact.
- [ ] Run the Agora hook tests and commit the slice.

## Task 5: Remove the copied parser

**Files:**

- Delete: `src/conversational-ai-api/index.ts`
- Delete: `src/conversational-ai-api/type.ts`
- Delete: `src/conversational-ai-api/utils/events.ts`
- Delete: `src/conversational-ai-api/utils/logger.ts`
- Delete: `src/conversational-ai-api/utils/sub-render.ts`
- Delete: copied-toolkit tests under `src/conversational-ai-api`

- [ ] Confirm no production imports remain.
- [ ] Delete the copied implementation and tests.
- [ ] Run the full test suite and commit the removal.

## Task 6: Verify the feature worktree

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Start `npm run dev` from this worktree.
- [ ] Verify `/` and `/call` load in the in-app browser.
- [ ] Confirm the console has no duplicate toolkit subscription errors.
- [ ] During a real call, verify Word waits for PTS and reveals progressively,
  Text shows complete updates, and Auto selects the available transport mode.
- [ ] Record any live Agora limitation separately from deterministic test results.
