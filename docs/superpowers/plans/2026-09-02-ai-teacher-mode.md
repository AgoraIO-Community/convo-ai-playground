# AI Teacher Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional Teacher Mode to the current ConvoAI call screen with an embedded Excalidraw blackboard, AI-avatar PiP, scripted demonstration, and a session-bound MCP drawing bridge.

**Architecture:** `VideoCallScreen` continues to own one uninterrupted Agora call while selecting Voice, Video, or Teacher presentation. A framework-independent teacher command reducer feeds an embedded Excalidraw scene from either a deterministic local lesson or authenticated commands published by a prototype Next.js MCP/session broker. The existing agent invite path attaches the internal teacher MCP server only at runtime and never mutates saved user MCP settings.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.8, Tailwind CSS 4, Zustand 5, Agora RTC/RTM and Agent Client Toolkit, `@excalidraw/excalidraw`, `@modelcontextprotocol/sdk`.

**Spec:** `docs/superpowers/specs/2026-09-02-ai-teacher-mode-design.md`

## Global Constraints

- Do not modify the main checkout; work only in `.worktrees/ai-teacher-excalidraw-prototype` on `feature/ai-teacher-excalidraw-prototype`.
- Per the user's explicit instruction, do not create automated test files or test cases and do not use TDD.
- Run the repository's existing tests unchanged as regression protection after implementation.
- Teacher Mode must not restart the Agora RTC/RTM connection or active ConvoAI agent.
- The student camera is hidden in Teacher Mode; the only PiP is the configured AI teacher avatar.
- Local scripted demo mode must remain clearly distinct from a verified live MCP connection.
- Never expose Agora credentials, provider keys, or teacher bearer tokens in client logs, saved settings, or persisted storage.
- Live MCP must not be claimed as working until exercised from a public HTTPS endpoint.

---

## File Map

### New teacher domain and client files

- `src/types/teacher.ts`: public command, scene, session, and connection types.
- `src/lib/teacher/commands.ts`: runtime validation and normalization for bounded drawing commands.
- `src/lib/teacher/boardReducer.ts`: ordered command application, ownership, stale-turn rejection, and interruption handling.
- `src/lib/teacher/demoLesson.ts`: deterministic photosynthesis lesson expressed only as valid commands.
- `src/lib/teacher/excalidrawAdapter.ts`: normalized scene to Excalidraw element conversion.
- `src/hooks/useTeacherBoardSession.ts`: session bootstrap, streaming fetch, reconnect, demo playback, and animation cancellation.
- `src/components/teacher/TeacherBoard.tsx`: client-only Excalidraw boundary and student-element ownership merge.
- `src/components/teacher/TeacherAvatarPiP.tsx`: existing Agora remote-avatar track in the approved small tile.
- `src/components/teacher/TeacherStage.tsx`: blackboard, PiP, status, and demo orchestration.

### New server files and routes

- `src/server/teacher/sessionBroker.ts`: two-hour session registry, bearer validation, bounded replay buffer, and subscribers.
- `src/server/teacher/mcpConfig.ts`: safe runtime-only teacher MCP configuration injection.
- `app/api/teacher/session/route.ts`: create/delete call-scoped teacher sessions.
- `app/api/teacher/events/route.ts`: authenticated newline-delimited event stream with replay.
- `app/api/teacher/mcp/route.ts`: streamable-HTTP MCP initialize/list/call surface exposing `teacher_draw`.

### Existing files to modify

- `package.json`, `package-lock.json`: add Excalidraw and MCP SDK dependencies.
- `.env.example`: document `TEACHER_MCP_PUBLIC_URL`.
- `src/types/callExperience.ts`: add `teacher`.
- `src/api/agentApi.ts`: send optional runtime teacher session metadata to the invite route.
- `app/api/agent/invite/route.ts`: append the internal MCP server to normal and custom runtime payloads.
- `src/components/CallExperienceModeSwitch.tsx`: accept `teacher` while leaving Voice/Video as the two visible choices.
- `src/components/Controls.tsx`: add the bottom Teacher Mode button and pass teacher session metadata when starting the agent.
- `src/screens/VideoCallScreen.tsx`: orchestrate three modes and mount the persistent Teacher stage.

---

### Task 1: Install dependencies and define the teacher command domain

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/types/teacher.ts`
- Create: `src/lib/teacher/commands.ts`
- Create: `src/lib/teacher/boardReducer.ts`
- Create: `src/lib/teacher/demoLesson.ts`

**Interfaces:**
- Produces: `TeacherDrawRequest`, `TeacherOperation`, `TeacherSceneElement`, `TeacherBoardState`, `TeacherSessionCredentials`, `TeacherStreamMessage`, `parseTeacherDrawRequest()`, `applyTeacherCommand()`, `interruptTeacherTurn()`, and `PHOTOSYNTHESIS_DEMO`.
- Consumes: no new project interfaces.

- [ ] **Step 1: Add the runtime libraries**

Run:

```bash
npm install @excalidraw/excalidraw @modelcontextprotocol/sdk
```

Inspect the installed package exports and peer-dependency output before importing from them. Do not run `npm audit fix` because it may introduce unrelated dependency changes.

- [ ] **Step 2: Define the bounded command and scene types**

Create discriminated operations with exact names:

```ts
export type TeacherOperation =
  | { type: "add_text"; elementId: string; x: number; y: number; text: string; color?: TeacherColor; fontSize?: number }
  | { type: "add_rectangle" | "add_ellipse" | "add_diamond"; elementId: string; x: number; y: number; width: number; height: number; color?: TeacherColor; label?: string }
  | { type: "add_arrow" | "add_line"; elementId: string; start: TeacherPoint; end: TeacherPoint; color?: TeacherColor; label?: string }
  | { type: "update_element"; elementId: string; patch: TeacherElementPatch }
  | { type: "delete_element"; elementId: string }
  | { type: "clear_ai_elements" }
  | { type: "clear_board" }
  | { type: "focus_area"; x: number; y: number; width: number; height: number };

export interface TeacherDrawRequest {
  turnId: string;
  sequence: number;
  animation: "progressive" | "instant";
  operations: TeacherOperation[];
}
```

Use a fixed `TeacherColor` union (`white`, `cyan`, `blue`, `green`, `amber`, `red`) so the LLM cannot inject arbitrary style strings.

The MCP wire schema uses the spec's snake-case names (`turn_id`, `element_id`); `parseTeacherDrawRequest()` normalizes them into the camel-case TypeScript domain shown above. `TeacherStreamMessage` is a discriminated union of `{ type: "command"; event: TeacherCommandEvent }` and `{ type: "heartbeat"; sentAt: number }`.

- [ ] **Step 3: Implement manual validation and normalization**

`parseTeacherDrawRequest(value: unknown)` returns:

```ts
type ParseTeacherDrawResult =
  | { ok: true; value: TeacherDrawRequest }
  | { ok: false; error: string };
```

Enforce: 1-24 operations per call, 80-character IDs, 500-character text/labels, finite coordinates between `-10_000` and `10_000`, sizes between `1` and `4_000`, and font sizes between `12` and `72`. Reject unknown operation types, remote URLs, HTML, and partial batches.

- [ ] **Step 4: Implement the pure board reducer**

Expose:

```ts
export function applyTeacherCommand(
  state: TeacherBoardState,
  event: TeacherCommandEvent,
): TeacherBoardState;

export function interruptTeacherTurn(
  state: TeacherBoardState,
): TeacherBoardState;
```

Track `elements`, `processedEventIds`, `activeTurnId`, `lastSequence`, `interruptedTurnIds`, `focusArea`, `revision`, and `clearBoardRevision`. Reject duplicate event IDs, non-increasing sequences, and events belonging to interrupted turns. AI delete/update operations can access only elements with `owner: "ai"`. Increment `clearBoardRevision` only for a validated full `clear_board`; the client board uses that signal to remove its student-owned elements.

- [ ] **Step 5: Express the demo through the public command contract**

Create `PHOTOSYNTHESIS_DEMO` as ordered `TeacherCommandEvent[]` with title, underline, Sunlight/Water/CO2 inputs, leaf/chloroplast center, Glucose/O2 outputs, arrows, and energy-storage note. Do not embed Excalidraw-specific objects in this file.

- [ ] **Step 6: Verify and commit the domain layer**

Run:

```bash
npx tsc --noEmit
git diff --check
```

Manually import the demo in a temporary `node`/TypeScript inspection only if needed; do not create a test file.

Commit:

```bash
git add package.json package-lock.json src/types/teacher.ts src/lib/teacher
git commit -m "feat: add teacher board command domain"
```

---

### Task 2: Build the prototype teacher session broker and API surface

**Files:**
- Create: `src/server/teacher/sessionBroker.ts`
- Create: `app/api/teacher/session/route.ts`
- Create: `app/api/teacher/events/route.ts`
- Create: `app/api/teacher/mcp/route.ts`

**Interfaces:**
- Consumes: `TeacherDrawRequest`, `TeacherCommandEvent`, and `parseTeacherDrawRequest()` from Task 1.
- Produces: `createTeacherSession()`, `authorizeTeacherSession()`, `publishTeacherCommand()`, `subscribeTeacherSession()`, `closeTeacherSession()`, and the three HTTP route contracts.

- [ ] **Step 1: Implement the in-process session registry**

Use a `globalThis` singleton so Next development reloads do not create disconnected route-local maps. Define:

```ts
interface TeacherSessionRecord {
  id: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  nextEventId: number;
  replay: TeacherCommandEvent[];
  subscribers: Set<(event: TeacherCommandEvent) => void>;
}
```

Generate IDs and 256-bit bearer tokens with `crypto.randomUUID()` and `crypto.randomBytes(32)`. Cap replay at 256 events, expire sessions after two hours, and use timing-safe token comparison.

- [ ] **Step 2: Add session create/delete route**

`POST /api/teacher/session` returns `{ sessionId, token, expiresAt, liveMcpConfigured }`. `DELETE` accepts the bearer token plus `sessionId`, closes subscribers, and removes the session. Send `Cache-Control: no-store`.

- [ ] **Step 3: Add the authenticated browser command stream**

Use a `ReadableStream` response with `application/x-ndjson`. Accept `Authorization: Bearer <token>`, `sessionId`, and optional `afterEventId`. Replay only newer buffered events as `{ type: "command", event }`, then enqueue one JSON message per line. Emit `{ type: "heartbeat", sentAt }` every 20 seconds and clear all timers/subscriptions on abort.

- [ ] **Step 4: Add the MCP route**

Use the installed MCP SDK's current streamable-HTTP server APIs after inspecting their local type declarations. The route must support initialization, `tools/list`, and `tools/call`; expose exactly one tool named `teacher_draw`; bind the target session from route query plus bearer token; pass tool arguments through `parseTeacherDrawRequest`; publish only a fully valid batch; and return a short acknowledgment containing the server event ID.

If the SDK's adapter cannot safely persist a transport in the Next route runtime, implement the same JSON-RPC methods in stateless mode while preserving MCP response shapes and `Content-Type` requirements. Do not fabricate unsupported protocol fields.

- [ ] **Step 5: Manually exercise the APIs and commit**

Run the dev server and use `curl` to create a session, open its event stream, call `tools/list`, and submit one valid and one invalid `teacher_draw` request. Confirm the valid event appears once and the invalid batch publishes nothing. Do not save real tokens in shell history or repository files.

Commit:

```bash
git add src/server/teacher/sessionBroker.ts app/api/teacher
git commit -m "feat: add teacher MCP session bridge"
```

---

### Task 3: Attach the teacher MCP bridge to agent start without changing saved settings

**Files:**
- Create: `src/server/teacher/mcpConfig.ts`
- Modify: `.env.example`
- Modify: `src/api/agentApi.ts`
- Modify: `src/components/Controls.tsx`
- Modify: `app/api/agent/invite/route.ts`

**Interfaces:**
- Consumes: `TeacherSessionCredentials` from Task 1 and server session authorization from Task 2.
- Produces: runtime invite metadata using `TeacherSessionCredentials` and `appendTeacherMcpToProperties()`.

- [ ] **Step 1: Define the runtime invite metadata**

Extend `inviteAgent()` options with:

```ts
teacherSession?: {
  sessionId: string;
  token: string;
};
```

Send it only in the one invite request. Never add it to `AgentSettings`, IndexedDB, custom settings JSON, logs, or agent-session history.

- [ ] **Step 2: Create the server-only MCP configuration helper**

`appendTeacherMcpToProperties(properties, teacherSession)` must:

1. Return an unchanged clone when `TEACHER_MCP_PUBLIC_URL` is absent.
2. Validate the session ID/token against the server registry.
3. Build `${TEACHER_MCP_PUBLIC_URL}/api/teacher/mcp?sessionId=...`.
4. Append a server named `teacherboard` with `transport: "streamable_http"`, `Authorization: Bearer ...`, and `allowed_tools: ["teacher_draw"]`.
5. Preserve all user MCP servers.
6. Set `advanced_features.enable_tools: true` for the non-MLLM pipeline.

- [ ] **Step 3: Apply the helper to normal and custom joins**

Add `teacherSession` to `InviteBody`. Apply the helper after canonical properties are built and after custom payload properties are cloned, but before masking/logging and calling Agora. This ensures the internal server is runtime-only and the masked payload never prints the bearer token.

- [ ] **Step 4: Pass current credentials from Controls**

Add `teacherSession?: TeacherSessionCredentials | null` to `ControlsProps` and pass it to `inviteAgent()`. Existing Start/Stop Agent behavior is otherwise unchanged.

- [ ] **Step 5: Document configuration and verify**

Add to `.env.example`:

```dotenv
# Public HTTPS origin used by Agora to reach the internal teacher MCP route.
# Leave empty for local scripted-demo mode.
TEACHER_MCP_PUBLIC_URL=""
```

With the variable empty, inspect the sanitized join payload and confirm no teacher MCP entry is present. With a safe local placeholder URL and a valid session, inspect only the sanitized payload and confirm `teacherboard` is appended while user MCP settings remain unchanged.

Commit:

```bash
git add .env.example src/api/agentApi.ts src/components/Controls.tsx src/server/teacher/mcpConfig.ts app/api/agent/invite/route.ts
git commit -m "feat: attach teacher tools to agent sessions"
```

---

### Task 4: Build the Excalidraw adapter and interactive blackboard

**Files:**
- Create: `src/lib/teacher/excalidrawAdapter.ts`
- Create: `src/components/teacher/TeacherBoard.tsx`

**Interfaces:**
- Consumes: `TeacherBoardState` and `TeacherSceneElement` from Task 1.
- Produces: `toExcalidrawElements(state)`, `TeacherBoardHandle`, and `TeacherBoard`.

- [ ] **Step 1: Inspect installed Excalidraw types and lock the adapter boundary**

Import the public React component and public element/app-state types only. Keep Excalidraw types out of the reducer and server files.

- [ ] **Step 2: Convert normalized elements**

Implement deterministic conversion for text, rectangle, ellipse, diamond, arrow, and line. Map the approved palette to dark-board colors, use roughness for a chalk feel, reserve the bottom-right PiP inset when focusing, and preserve stable IDs/version increments.

- [ ] **Step 3: Implement the client-only board**

Dynamically load Excalidraw with SSR disabled. Import its stylesheet from the client boundary. Configure a dark theme, grid/background, reduced toolbar surface, and `initialData` suitable for the approved visual.

Expose:

```ts
export interface TeacherBoardHandle {
  applyState(state: TeacherBoardState, animation: "progressive" | "instant"): Promise<void>;
  cancelAnimation(): void;
  reset(): void;
}
```

Capture student-created/edited elements from `onChange`, tag them `owner: "student"` in component-local metadata, and merge them with AI elements by ID. Never let an AI-only clear delete student elements. When `clearBoardRevision` changes, clear the component-local student set exactly once as well as the AI scene.

- [ ] **Step 4: Style and manually inspect the board**

Render the demo scene in isolation within the call stage. Confirm toolbar access, dark background, chalk palette, labels, arrows, zoom controls, and protected PiP area at desktop and compact widths.

Commit:

```bash
git add src/lib/teacher/excalidrawAdapter.ts src/components/teacher/TeacherBoard.tsx
git commit -m "feat: add interactive teacher blackboard"
```

---

### Task 5: Implement the teacher session hook and demo playback

**Files:**
- Create: `src/hooks/useTeacherBoardSession.ts`

**Interfaces:**
- Consumes: Task 1 reducer/demo contracts and Task 2 session/event endpoints.
- Produces: `UseTeacherBoardSessionResult` for `TeacherStage` and `TeacherSessionCredentials` for `Controls`.

- [ ] **Step 1: Bootstrap and close the teacher session**

The hook creates one session per call-screen mount, holds credentials in React memory, and sends `DELETE` with `keepalive: true` during final cleanup. Do not recreate the session when the user switches presentation modes.

- [ ] **Step 2: Consume the NDJSON stream with replay**

Use authenticated `fetch`, a `ReadableStreamDefaultReader`, `TextDecoder`, and a carry buffer for split lines. Ignore heartbeat messages after updating liveness; apply only command messages. Track `lastEventId`; reconnect with bounded exponential backoff from 500 ms to 10 seconds; stop reconnecting when the hook is disposed.

- [ ] **Step 3: Apply commands and expose interruption**

Return:

```ts
interface UseTeacherBoardSessionResult {
  session: TeacherSessionCredentials | null;
  boardState: TeacherBoardState;
  connection: "connecting" | "live" | "offline" | "demo";
  activeAnimation: "progressive" | "instant";
  playDemo(): Promise<void>;
  pauseDemo(): void;
  resumeDemo(): void;
  clearBoard(): void;
}
```

Accept `agentState` as input. When it transitions from thinking/speaking to listening, call `interruptTeacherTurn()` and cancel queued demo/live reveal operations while keeping committed elements.

- [ ] **Step 4: Implement deterministic demo controls**

Play `PHOTOSYNTHESIS_DEMO` with short command-level delays. Use one cancellation token for pause, interruption, mode exit, and call end. Reduced-motion mode applies each event instantly.

- [ ] **Step 5: Exercise offline/reconnect/interruption manually and commit**

Use browser network controls to disable and restore the event request. Confirm the status changes without affecting the call, and confirm the demo can pause/resume without duplicate elements.

Commit:

```bash
git add src/hooks/useTeacherBoardSession.ts
git commit -m "feat: orchestrate teacher board sessions"
```

---

### Task 6: Build the approved Teacher stage and avatar PiP

**Files:**
- Create: `src/components/teacher/TeacherAvatarPiP.tsx`
- Create: `src/components/teacher/TeacherStage.tsx`

**Interfaces:**
- Consumes: `TeacherBoard`, `useTeacherBoardSession()` output, existing `IRemoteVideoTrack`, agent state/name/ID, and transmission mode.
- Produces: a responsive `TeacherStage` used by `VideoCallScreen`.

- [ ] **Step 1: Implement the PiP using the existing Agora track lifecycle pattern**

Play `agentAvatarVideoTrack` into a ref, set injected video to `object-fit: cover`, observe asynchronously inserted video elements, and stop only playback on component cleanup without closing the shared remote track. Show “Teacher connecting” when avatar is configured but pending; otherwise render compact `VoiceAgentStage` as the no-avatar fallback.

- [ ] **Step 2: Compose the stage**

`TeacherStage` renders the board full-size, status badge in the top-right safe area, conditional **Play demo lesson** control when live MCP is unavailable, and the 16:9 avatar PiP at bottom-right. Use the approved rounded navy/black surface, subtle cyan outline, responsive PiP sizing, and `aria-live="polite"` status text.

- [ ] **Step 3: Verify responsive visual behavior and commit**

Confirm the PiP does not obscure focused content, transcript layout stays unchanged, controls remain reachable, and compact view has no page-level horizontal overflow.

Commit:

```bash
git add src/components/teacher
git commit -m "feat: add AI teacher stage"
```

---

### Task 7: Integrate Teacher Mode into the current call layout

**Files:**
- Modify: `src/types/callExperience.ts`
- Modify: `src/components/CallExperienceModeSwitch.tsx`
- Modify: `src/components/Controls.tsx`
- Modify: `src/screens/VideoCallScreen.tsx`

**Interfaces:**
- Consumes: `TeacherStage`, `useTeacherBoardSession()`, and existing `setLocalVideoEnabled()`.
- Produces: complete Voice/Video/Teacher mode switching in one live call.

- [ ] **Step 1: Extend mode types without adding a third header segment**

Set `CallExperienceMode = "voice" | "video" | "teacher"`. Type the header switch choices as `Exclude<CallExperienceMode, "teacher">`; when `value === "teacher"`, neither visible radio is checked.

- [ ] **Step 2: Add the bottom Teacher control**

Add `onTeacherModeToggle: () => Promise<void>` and `teacherModeLoading` to `ControlsProps`. Use `MdSchool` or `MdDraw` in a circular button after Start Agent and before Settings. Expose `aria-pressed`, “Enter Teacher Mode”/“Exit Teacher Mode” labels, disabled/loading state, active cyan styling, and no camera button while Teacher Mode is active.

- [ ] **Step 3: Orchestrate camera-safe transitions**

In `VideoCallScreen`, track:

```ts
const [callExperienceMode, setCallExperienceMode] = useState<CallExperienceMode>(initialMode);
const previousNonTeacherModeRef = useRef<"voice" | "video">(initialMode);
```

Entering Teacher Mode disables the camera first, then records the previous mode and switches the stage. Exiting restores the previous mode; if camera enable fails for Video, use Voice and show a toast. Selecting Voice or Video in the header exits Teacher Mode explicitly.

- [ ] **Step 4: Keep the Teacher stage mounted for board persistence**

Mount `TeacherStage` for the call lifetime in an absolute stage layer. When inactive, use `invisible pointer-events-none` rather than conditional unmounting; when activated, request an Excalidraw viewport refresh before rendering the next command. Keep `useTeacherBoardSession` above the presentation branches so neither server state nor local student annotations are destroyed on mode changes. Pass its session credentials to `Controls` so an agent started before or after entering Teacher Mode gets the live tool configuration when available.

- [ ] **Step 5: Verify all transitions and commit**

Manually exercise Voice -> Teacher -> Voice, Video -> Teacher -> Video, Teacher -> header Voice, Teacher -> header Video, camera-denied fallback, active-agent switching, and call end. Confirm transcript and agent IDs remain unchanged across mode changes.

Commit:

```bash
git add src/types/callExperience.ts src/components/CallExperienceModeSwitch.tsx src/components/Controls.tsx src/screens/VideoCallScreen.tsx
git commit -m "feat: integrate teacher mode into calls"
```

---

### Task 8: Regression verification and visual handoff

**Files:**
- Modify only files required to correct issues found during verification.
- Do not create automated tests.

**Interfaces:**
- Consumes: complete implementation from Tasks 1-7.
- Produces: verified local prototype and user-facing screenshots/status.

- [ ] **Step 1: Run static and existing regression checks**

Run:

```bash
npx tsc --noEmit
npm run lint
npm test -- --run
npm run build
git diff --check
```

Existing tests must remain unmodified. If an existing test fails, diagnose the regression in implementation code; do not rewrite the test to accommodate the feature.

- [ ] **Step 2: Perform visual browser verification**

Start the worktree with `npm run dev`. Verify desktop and compact layouts, the photosynthesis demo, toolbar interaction, AI/student ownership behavior, interruption, avatar video/fallback, offline indicator, and all mode transitions. Inspect console and network panels for unhandled errors or leaked tokens.

- [ ] **Step 3: Capture prototype evidence**

Capture at least one desktop Teacher Mode screenshot matching the approved reference and one compact-layout screenshot. Keep screenshots outside the source tree unless the user asks to commit them.

- [ ] **Step 4: Inspect final branch state and commit fixes**

Run:

```bash
git status --short
git log --oneline --decorate -8
```

Commit only focused verification fixes with a descriptive message. Do not merge, rebase, or modify main.

- [ ] **Step 5: Report capability boundaries accurately**

Report the scripted demo as locally verified. Report live MCP as configured but unverified unless a public HTTPS endpoint and working Agora agent complete an actual voice-to-board tool call. Include the worktree path, branch, relevant commits, checks run, and screenshots.
