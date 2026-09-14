# Cinematic AI Teacher Call Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cinematic `/call` landing experience with a live Photosynthesis board preview, then enter the existing call dashboard in Teacher Mode with the transcript closed in an accessible slide-over drawer.

**Architecture:** `CallBootstrapScreen` becomes an explicit landing/joining/active state machine and delegates the cinematic presentation to a new `TeacherDemoLandingScreen`. The landing reuses `useTeacherBoardSession` in a new local-only mode plus `TeacherStage` in a presentation variant, so it never creates an Agora call, teacher session, or agent. The active dashboard preserves existing call and agent logic while defaulting to Teacher Mode and rendering the existing transcript panel inside a new responsive overlay drawer.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, Zustand, Excalidraw, Agora RTC/RTM and Conversational AI, React Icons.

**Spec:** `docs/superpowers/specs/2026-09-09-cinematic-ai-teacher-call-design.md`

## Global Constraints

- Work only in `.worktrees/ai-teacher-excalidraw-prototype` on `feature/ai-teacher-excalidraw-prototype`; do not modify `main`.
- Exact footer branding is `Powered by Agora Conversational AI`.
- The primary landing action is `Enter the classroom`.
- Joining the classroom must not start the AI agent.
- Do not add a prerecorded video, stock photography, or a new media asset; reuse the live Photosynthesis Excalidraw demo.
- Preserve Weather MCP, Teacher MCP, saved MCP entries, avatar configuration, model/voice settings, the Teacher Lesson Director, and Voice/Video modes.
- Do not add or modify automated test files, per the user's instruction. Run existing verification and report results honestly.
- `src/screens/CallBootstrapScreen.test.ts` currently asserts automatic joining on initial render. The approved CTA-gated behavior intentionally invalidates that assertion; because test-file edits are forbidden, report those cases as stale expected failures rather than adding a production-only test bypass.
- Use `motion-reduce:` and `motion-safe:` behavior so reduced-motion users receive a stable completed preview and non-sliding drawer.
- Do not add dependencies or require new environment variables.

## File Structure

- Create `src/screens/TeacherDemoLandingScreen.tsx`: cinematic copy, CTA/error states, capability chips, and the local looping board preview.
- Create `src/components/TranscriptDrawer.tsx`: responsive left overlay, edge trigger, focus management, Escape handling, backdrop, and reduced-motion presentation.
- Modify `src/hooks/useTeacherBoardSession.ts`: add an opt-out for remote teacher session creation so the landing preview is local-only.
- Modify `src/components/teacher/TeacherStage.tsx`: add a preview variant that removes live classroom controls and uses compact preview sizing/status.
- Modify `src/screens/CallBootstrapScreen.tsx`: replace auto-join/loading skeleton with the explicit landing/joining/active state machine.
- Modify `src/components/TranscriptSidePanel.tsx`: allow an embedded panel to render its own accessible close button.
- Modify `src/screens/VideoCallScreen.tsx`: default to Teacher Mode, keep the board full width, and integrate the transcript drawer.
- Do not modify files under `src/**/*.test.*`.

---

### Task 1: Add a Local-Only Teacher Board Preview Mode

**Files:**
- Modify: `src/hooks/useTeacherBoardSession.ts:22-31,57-59,60-76,142-191`
- Modify: `src/components/teacher/TeacherStage.tsx:26-38,40-97,99-114,132-206`

**Interfaces:**
- Produces: `UseTeacherBoardSessionOptions` with `connectRemote?: boolean`.
- Produces: `useTeacherBoardSession(agentState, options?)`, defaulting to current remote behavior.
- Produces: `TeacherStage` prop `variant?: "interactive" | "preview"`, defaulting to `interactive`.
- Preserves: the existing `UseTeacherBoardSessionResult` contract for all consumers.

- [ ] **Step 1: Add the local-only session option without changing live callers**

In `src/hooks/useTeacherBoardSession.ts`, define the option and default it at the hook boundary:

```ts
export interface UseTeacherBoardSessionOptions {
  connectRemote?: boolean;
}

export function useTeacherBoardSession(
  _agentState: EAgentState,
  options: UseTeacherBoardSessionOptions = {},
): UseTeacherBoardSessionResult {
  const connectRemote = options.connectRemote ?? true;
  const [connection, setConnection] = useState<TeacherConnectionState>(
    connectRemote ? "connecting" : "demo",
  );
```

Keep all existing board/demo state and callbacks. At the start of the session-creation effect, initialize `mountedRef`, then short-circuit when remote connectivity is disabled:

```ts
useEffect(() => {
  mountedRef.current = true;

  if (!connectRemote) {
    return () => {
      mountedRef.current = false;
      pauseDemo();
    };
  }

  let disposed = false;
  let credentials: TeacherSessionCredentials | null = null;
}, [connectRemote, pauseDemo]);
```

After those declarations, keep the current asynchronous `POST /api/teacher/session` block and its authenticated `DELETE` cleanup byte-for-byte. Do not special-case `fetch` globally and do not change the default used by `VideoCallScreen`.

- [ ] **Step 2: Add a non-interactive presentation variant to `TeacherStage`**

Extend `TeacherStageProps` and derive the visual behavior:

```ts
interface TeacherStageProps {
  active: boolean;
  teacher: UseTeacherBoardSessionResult;
  agentId?: string | null;
  agentName: string;
  agentState: EAgentState;
  transcriptionMode: "rtc" | "rtm";
  avatarVideoTrack?: IRemoteVideoTrack | null;
  avatarExpected?: boolean;
  lessonStatus?: TeacherLessonStatus;
  lessonProgress?: TeacherLessonProgress | null;
  onClearBoard?: () => void;
  variant?: "interactive" | "preview";
}

const TeacherStage: React.FC<TeacherStageProps> = ({
  active,
  teacher,
  agentId,
  agentName,
  agentState,
  transcriptionMode,
  avatarVideoTrack = null,
  avatarExpected = false,
  lessonStatus = "idle",
  lessonProgress = null,
  onClearBoard,
  variant = "interactive",
}) => {
  const isPreview = variant === "preview";
  const canPlayDemo = !isPreview && !teacher.session?.liveMcpConfigured;
```

For preview mode:

- use `min-h-[300px] sm:min-h-[420px]` rather than the active classroom's taller minimum;
- show the status `Live lesson preview` with a cyan dot;
- hide the entire bottom-left play/pause/clear control group;
- retain the `AI Teacher` chip, Excalidraw canvas, and avatar picture-in-picture;
- add `motion-reduce:animate-none` to status dots that currently animate.

Use the default `interactive` branch for the existing call and preview route so their behavior does not change.

- [ ] **Step 3: Run focused static verification**

Run:

```bash
npx eslint src/hooks/useTeacherBoardSession.ts src/components/teacher/TeacherStage.tsx
npx tsc --noEmit --pretty false
```

Expected: no new errors in either modified application file. If the TypeScript command reports the known pre-existing test-fixture errors, record them separately and confirm neither modified file appears in the output.

- [ ] **Step 4: Commit the local preview infrastructure**

```bash
git add src/hooks/useTeacherBoardSession.ts src/components/teacher/TeacherStage.tsx
git commit -m "feat: support local teacher board previews"
```

---

### Task 2: Build the Cinematic Teacher Landing Screen

**Files:**
- Create: `src/screens/TeacherDemoLandingScreen.tsx`

**Interfaces:**
- Consumes: `useTeacherBoardSession(EAgentState.SPEAKING, { connectRemote: false })` from Task 1.
- Consumes: `TeacherStage` with `variant="preview"` from Task 1.
- Produces: `TeacherLandingPhase = "landing" | "joining" | "error"`.
- Produces: `TeacherDemoLandingScreenProps` used by `CallBootstrapScreen` in Task 3.

- [ ] **Step 1: Define the landing component contract and local demo lifecycle**

Create `src/screens/TeacherDemoLandingScreen.tsx` with this public contract:

```ts
export type TeacherLandingPhase = "landing" | "joining" | "error";

interface TeacherDemoLandingScreenProps {
  phase: TeacherLandingPhase;
  errorMessage?: string;
  onEnter(): void;
  onRetry(): void;
  onSignOut(): void;
}
```

Initialize the board without remote server access:

```ts
const teacher = useTeacherBoardSession(EAgentState.SPEAKING, {
  connectRemote: false,
});
const playDemo = teacher.playDemo;
const pauseDemo = teacher.pauseDemo;
```

Add an effect that:

1. reads `window.matchMedia("(prefers-reduced-motion: reduce)")`;
2. plays the demo once in reduced-motion mode, where existing board logic applies the completed state instantly;
3. otherwise awaits `playDemo()`, waits 1,600 ms, and repeats while mounted;
4. tracks the active timeout ID, clears it, and calls `pauseDemo()` during cleanup.

The loop must be cancelled on unmount and must never call `/api/teacher/session`, Agora APIs, or agent APIs.

- [ ] **Step 2: Implement the cinematic responsive composition**

Build one full-height page with this exact outer layout; place the story content described below in the first `section` and the `TeacherStage` block from Step 3 in the second `section`:

```tsx
<main className="relative min-h-screen overflow-hidden bg-[#02050c] text-white">
  <div
    aria-hidden
    className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_78%_70%,rgba(99,102,241,0.14),transparent_38%)]"
  />
  <div className="relative mx-auto grid min-h-screen max-w-[1600px] items-center gap-10 px-5 py-8 lg:grid-cols-[0.78fr_1.22fr] lg:px-10 xl:px-16">
    <section className="flex min-w-0 flex-col items-start" />
    <section className="min-w-0" />
  </div>
</main>
```

The left section contains these exact or approved strings:

```tsx
<p>AI Teacher</p>
<h1>Teach anything. Make it visible.</h1>
<p>The classroom, reimagined for natural conversation and visual understanding.</p>
```

Render capability chips from a constant:

```ts
const capabilities = [
  "Speak naturally",
  "Interrupt anytime",
  "Visual explanations",
] as const;
```

The primary button behavior is:

```tsx
<button
  type="button"
  onClick={phase === "error" ? onRetry : onEnter}
  disabled={phase === "joining"}
  aria-busy={phase === "joining"}
>
  {phase === "joining"
    ? "Connecting classroom…"
    : phase === "error"
      ? "Try again"
      : "Enter the classroom"}
</button>
```

Render the error in a compact `role="alert"` block only in the error phase. Keep `Sign out` as a secondary text/button action. Finish the story column with the exact line:

```tsx
<p>Powered by Agora Conversational AI</p>
```

Use `motion-safe:` for ambient glow animation and `motion-reduce:` to disable it. Do not add global CSS unless a Tailwind utility cannot express a required state.

- [ ] **Step 3: Render the actual Photosynthesis product proof**

In the right section, use the live component rather than an image:

```tsx
<div className="relative aspect-[16/10] min-h-[320px] overflow-hidden rounded-[30px] border border-cyan-200/20 bg-[#020908] shadow-[0_32px_120px_rgba(8,145,178,0.18)] sm:min-h-[440px]">
  <TeacherStage
    active
    variant="preview"
    teacher={teacher}
    agentName="Maya"
    agentState={EAgentState.SPEAKING}
    transcriptionMode="rtm"
  />
</div>
```

Add a small presentation badge such as `Live classroom preview` outside the board stage. Do not pass `avatarExpected`; the preview intentionally uses the existing local teacher glyph rather than pretending a remote avatar has joined.

- [ ] **Step 4: Run focused static verification**

Run:

```bash
npx eslint src/screens/TeacherDemoLandingScreen.tsx
npx tsc --noEmit --pretty false
```

Expected: no application error in the new screen. Record only unrelated known fixture errors from TypeScript.

- [ ] **Step 5: Commit the landing screen**

```bash
git add src/screens/TeacherDemoLandingScreen.tsx
git commit -m "feat: add cinematic AI teacher landing"
```

---

### Task 3: Gate Agora Joining Behind the Landing CTA

**Files:**
- Modify: `src/screens/CallBootstrapScreen.tsx:3-12,14-75,77-103`

**Interfaces:**
- Consumes: `TeacherDemoLandingScreen` and `TeacherLandingPhase` from Task 2.
- Preserves: existing `createRtcSession`, `joinMeeting`, transcript transport, and `callStart` payload behavior.
- Produces: `BootstrapStatus = "landing" | "joining" | "active" | "error"`.

- [ ] **Step 1: Replace automatic bootstrap with the explicit state transition**

Remove `MeetingLoadingSkeleton`. Initialize with:

```ts
type BootstrapStatus = "landing" | "joining" | "active" | "error";

const [status, setStatus] = useState<BootstrapStatus>(
  callActive ? "active" : "landing",
);
```

Retain `hasStartedRef` and `attempt` so React Strict Mode cannot create two sessions. Gate the existing join effect before reading settings or starting work:

```ts
if (callActive) {
  setStatus("active");
  return;
}
if (status !== "joining" || !agentSettings || hasStartedRef.current) return;
hasStartedRef.current = true;
```

Use this bootstrap body and include `status` in the effect dependencies:

```ts
const bootstrap = async (): Promise<void> => {
  setErrorMessage("");
  try {
    const session = await createRtcSession();
    await joinMeeting(
      session,
      getTranscriptTransport(agentSettings) === "rtm",
    );
    callStart({
      displayName: session.displayName,
      rtcUid: String(session.rtcUid),
      channelName: session.channelName,
      startedAt: Date.now(),
    });
    setStatus("active");
  } catch (error) {
    setErrorMessage(
      error instanceof Error ? error.message : "Unable to start the call",
    );
    setStatus("error");
  }
};

void bootstrap();
```

- [ ] **Step 2: Add enter and retry handlers**

Use explicit handlers:

```ts
const handleEnter = useCallback((): void => {
  if (status === "joining") return;
  hasStartedRef.current = false;
  setErrorMessage("");
  setStatus("joining");
  setAttempt((value) => value + 1);
}, [status]);

const handleRetry = useCallback((): void => {
  hasStartedRef.current = false;
  setErrorMessage("");
  setStatus("joining");
  setAttempt((value) => value + 1);
}, []);
```

Do not call the agent invite API from either handler.

- [ ] **Step 3: Render landing, joining, and errors through one screen**

Keep the active branch:

```tsx
if (status === "active") return <VideoCallScreen />;
```

Replace the old loading and error branches with:

```tsx
return (
  <TeacherDemoLandingScreen
    phase={status}
    errorMessage={errorMessage}
    onEnter={handleEnter}
    onRetry={handleRetry}
    onSignOut={handleSignOut}
  />
);
```

Narrow `phase` safely because the active branch has already returned. The landing remains mounted during joining and error states.

- [ ] **Step 4: Run existing verification and record the deliberate stale-test mismatch**

Run:

```bash
npx eslint src/screens/CallBootstrapScreen.tsx src/screens/TeacherDemoLandingScreen.tsx
npm test -- src/screens/CallBootstrapScreen.test.ts
```

Expected application result: lint passes. Expected test result under the no-test-edit constraint: the existing auto-join assertions fail because the component now correctly waits for `Enter the classroom`. Record the failure; do not add `NODE_ENV` branches or silently auto-click the CTA in production code.

- [ ] **Step 5: Commit the CTA-gated bootstrap**

```bash
git add src/screens/CallBootstrapScreen.tsx
git commit -m "feat: enter teacher classroom before joining"
```

---

### Task 4: Add the Accessible Transcript Drawer

**Files:**
- Create: `src/components/TranscriptDrawer.tsx`
- Modify: `src/components/TranscriptSidePanel.tsx:17-29,300-336`

**Interfaces:**
- Produces: `TranscriptDrawerProps { isOpen: boolean; onOpen(): void; onClose(): void; children: React.ReactNode }`.
- Produces: `TranscriptSidePanel` prop `showCloseButton?: boolean`, default `false` for embedded panels.
- Preserves: all transcript rendering, messaging, instruction, image-input, and transport behavior.

- [ ] **Step 1: Permit an embedded transcript to expose its close control**

Extend the existing props:

```ts
interface TranscriptSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage?: (text: string, image?: File) => void;
  embedded?: boolean;
  showCloseButton?: boolean;
}
```

Default `showCloseButton = false` and change the existing close-button condition to:

```tsx
{(!embedded || showCloseButton) && (
  <button
    type="button"
    onClick={onClose}
    aria-label="Close transcript and chat"
    className="shrink-0 rounded-lg p-2 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-400 dark:hover:bg-gray-800"
  >
    <MdClose aria-hidden className="text-gray-500 dark:text-gray-400" size={24} />
  </button>
)}
```

- [ ] **Step 2: Create the responsive overlay and left-edge trigger**

Create `src/components/TranscriptDrawer.tsx`. The component owns a trigger ref and panel ref. Its outer structure is:

```tsx
<>
  <button
    ref={triggerRef}
    type="button"
    onClick={onOpen}
    aria-label="Open transcript and chat"
    aria-controls="live-transcript-drawer"
    aria-expanded={isOpen}
    className={`absolute left-0 top-1/2 z-40 flex -translate-y-1/2 items-center gap-2 rounded-r-full border border-l-0 border-cyan-200/20 bg-slate-950/90 px-3 py-2 text-xs font-semibold text-cyan-50 shadow-xl backdrop-blur transition motion-reduce:transition-none ${
      isOpen
        ? "pointer-events-none -translate-x-full opacity-0"
        : "translate-x-0 opacity-100 hover:bg-slate-900"
    }`}
  >
    <MdChat aria-hidden />
    <span>Transcript</span>
  </button>

  <div className={isOpen ? "absolute inset-0 z-40" : "pointer-events-none absolute inset-0 z-40 invisible"}>
    <button
      type="button"
      tabIndex={-1}
      aria-label="Close transcript drawer"
      onClick={onClose}
      className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
    />
    <aside
      id="live-transcript-drawer"
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Live transcript and chat"
      tabIndex={-1}
      inert={!isOpen}
      className="absolute inset-y-0 left-0 w-[min(92vw,390px)] border-r border-white/10 bg-slate-900 shadow-2xl transition-transform duration-300 motion-reduce:transition-none"
    >
      {children}
    </aside>
  </div>
</>
```

Use transform classes so the panel is `translate-x-0` when open and `-translate-x-full` when closed. The trigger sits at `left-0 top-1/2` inside the classroom main region and remains usable at all breakpoints.

- [ ] **Step 3: Implement keyboard and focus behavior**

Add one effect:

```ts
useEffect(() => {
  if (!isOpen) return;
  panelRef.current?.focus();

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") onClose();
  };
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [isOpen, onClose]);
```

Track the previous `isOpen` value. When it changes from `true` to `false`, call `triggerRef.current?.focus()` so keyboard focus returns to the control that opened the drawer. Do not steal focus on the initial closed render.

- [ ] **Step 4: Run focused static verification**

Run:

```bash
npx eslint src/components/TranscriptDrawer.tsx src/components/TranscriptSidePanel.tsx
npx tsc --noEmit --pretty false
```

Expected: no new error in either drawer/transcript file; only documented pre-existing fixture errors may remain.

- [ ] **Step 5: Commit the drawer**

```bash
git add src/components/TranscriptDrawer.tsx src/components/TranscriptSidePanel.tsx
git commit -m "feat: add accessible transcript drawer"
```

---

### Task 5: Make Teacher Mode the Default Active Classroom

**Files:**
- Modify: `src/screens/VideoCallScreen.tsx:3-23,34-90,141-202,231-253,255-303,313-325,389-421`

**Interfaces:**
- Consumes: `TranscriptDrawer` from Task 4.
- Consumes: `TranscriptSidePanel showCloseButton` from Task 4.
- Preserves: `Controls`, mode switching, lesson Director, Agora call lifecycle, avatar video, and chat sending.

- [ ] **Step 1: Initialize Teacher Mode and unpublish local camera once**

Keep `previousNonTeacherModeRef` based on the starting camera preference, but replace the visible initial mode:

```ts
const initialVideoMutedRef = useRef(videoMuted);
const [callExperienceMode, setCallExperienceMode] =
  useState<CallExperienceMode>("teacher");
const previousNonTeacherModeRef = useRef<StandardCallExperienceMode>(
  initialVideoMutedRef.current ? "voice" : "video",
);
const didApplyTeacherDefaultRef = useRef(false);
```

After `useAgora()` is available, add a once-only effect:

```ts
useEffect(() => {
  if (didApplyTeacherDefaultRef.current) return;
  didApplyTeacherDefaultRef.current = true;
  void setLocalVideoEnabled(false).catch(() => {
    showToast("Camera could not be disabled for Teacher Mode.", "error");
  });
}, [setLocalVideoEnabled]);
```

This changes camera publication only; it does not start the agent.

- [ ] **Step 2: Update the classroom identity without removing other modes**

When `callExperienceMode === "teacher"`, use:

```tsx
<p className="truncate text-sm font-semibold sm:text-base">AI Teacher classroom</p>
<p className="text-xs text-slate-400">Powered by Agora Conversational AI</p>
```

Keep the existing connectivity subtitle for Voice/Video modes. Continue rendering `CallExperienceModeSwitch` so Voice and Video are reachable, and keep the existing bottom Teacher Mode toggle so users can return to the board.

- [ ] **Step 3: Replace the permanent transcript column and mobile sheet**

Remove:

- the desktop `<aside>` whose class begins `hidden w-[350px] shrink-0`;
- the mobile-only header chat icon;
- the `BottomSheet` import and render.

Keep `isTranscriptOpen` initialized to `false`. Render the transcript with a close button:

```tsx
const transcript = (
  <TranscriptSidePanel
    isOpen={isTranscriptOpen}
    onClose={() => setIsTranscriptOpen(false)}
    embedded
    showCloseButton
    onSendMessage={
      callExperienceMode === "teacher"
        ? canSendTeacherQuestion
          ? handleTeacherMessage
          : undefined
        : canSendChat
          ? sendChatMessage
          : undefined
    }
  />
);
```

Inside the existing classroom `<main className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden">`, after the teacher and Voice/Video stage layers, render:

```tsx
<TranscriptDrawer
  isOpen={isTranscriptOpen}
  onOpen={() => setIsTranscriptOpen(true)}
  onClose={() => setIsTranscriptOpen(false)}
>
  {transcript}
</TranscriptDrawer>
```

Because the drawer is absolutely positioned inside `main`, opening it overlays the board without changing the board's dimensions.

- [ ] **Step 4: Make the pre-agent avatar state honest**

Change the TeacherStage avatar expectation to wait for an active agent:

```tsx
avatarExpected={
  isAgentActive && Boolean(agentSettings?.avatar?.enable)
}
```

Before `Start agent`, the picture-in-picture shows the local ready state. After agent creation, the existing connecting state and remote video track behavior apply.

- [ ] **Step 5: Preserve teacher chat and mode transitions**

Re-read these existing blocks without changing their behavior:

- `handleTeacherMessage` must still require active agent, agent ID, and teacher session;
- `handleExperienceModeChange` must still publish/unpublish camera correctly;
- `handleTeacherModeToggle` must still restore the prior Voice/Video mode;
- `useTeacherLessonDirector` must still be active only for Teacher Mode plus an active agent;
- `Controls` must still receive `teacher.session` so agent creation waits for a ready teacher session.

Manually confirm the resulting `VideoCallScreen` has only one transcript panel instance and no imported `BottomSheet` or `MdChat`.

- [ ] **Step 6: Run focused static verification**

Run:

```bash
npx eslint src/screens/VideoCallScreen.tsx src/components/TranscriptDrawer.tsx src/components/TranscriptSidePanel.tsx
npx tsc --noEmit --pretty false
```

Expected: no new application error. Existing tests that assert Voice/Video as the initial mode are now stale under the no-test-edit constraint and should be reported, not bypassed in production code.

- [ ] **Step 7: Commit the active classroom layout**

```bash
git add src/screens/VideoCallScreen.tsx
git commit -m "feat: default calls to the teacher classroom"
```

---

### Task 6: Rendered QA, Regression Verification, and Final Polish

**Files:**
- Modify only if rendered QA reveals a concrete issue: `src/screens/TeacherDemoLandingScreen.tsx`, `src/components/TranscriptDrawer.tsx`, `src/components/teacher/TeacherStage.tsx`, `src/screens/CallBootstrapScreen.tsx`, `src/screens/VideoCallScreen.tsx`
- Do not modify: any `*.test.*` file

**Interfaces:**
- Consumes: the complete landing, bootstrap, drawer, and Teacher Mode flow from Tasks 1–5.
- Produces: presentation-ready behavior at desktop, tablet, and mobile widths.

- [ ] **Step 1: Start the feature-worktree server**

Confirm port ownership before starting. If the intended port is already used by this worktree, reuse the process. Otherwise run:

```bash
npm run dev -- --port 3000
```

Open `http://localhost:3000/call` and confirm the server path resolves to this feature worktree, not `main` or another checkout.

- [ ] **Step 2: Verify the landing without creating external sessions**

Before clicking the CTA, use browser network inspection and visual state to confirm:

- no RTC session request is sent;
- no AI agent invite request is sent;
- no `/api/teacher/session` request is sent by the preview;
- the Photosynthesis board draws labels, shapes, and connectors, then loops;
- the capability chips and exact Agora branding render;
- reduced-motion emulation produces a stable completed board instead of a fast loop.

- [ ] **Step 3: Verify the join and active classroom flow**

Click `Enter the classroom` and confirm:

- the same landing remains visible with `Connecting classroom…`;
- only one RTC session is created under React Strict Mode;
- the active screen opens in Teacher Mode;
- the board uses the full classroom width;
- the agent is stopped and settings can be opened;
- clicking `Start agent` follows the current configured agent/avatar/MCP path;
- Voice Agent and Video Agent still work and Teacher Mode can be re-entered.

Exercise an error by temporarily blocking the RTC session request in browser devtools, then confirm the inline alert, `Try again`, and `Sign out` actions remain usable. Remove the block after the check.

- [ ] **Step 4: Verify the transcript drawer and responsive layouts**

At approximately 1440 px, 1024 px, 768 px, and 390 px viewport widths, confirm:

- transcript is closed initially;
- the left-edge `Transcript` trigger is visible and keyboard reachable;
- opening the drawer does not shift or resize the board;
- close button, backdrop, and `Escape` close it;
- focus enters the drawer and returns to the trigger;
- the mobile drawer is near full width without horizontal overflow;
- the CTA, call controls, avatar tile, timer, and settings remain reachable.

- [ ] **Step 5: Fix only concrete visual defects and lint touched files**

For each concrete defect, edit the smallest owning component and rerun:

```bash
npx eslint src/screens/TeacherDemoLandingScreen.tsx src/screens/CallBootstrapScreen.tsx src/screens/VideoCallScreen.tsx src/components/TranscriptDrawer.tsx src/components/TranscriptSidePanel.tsx src/components/teacher/TeacherStage.tsx src/hooks/useTeacherBoardSession.ts
```

Expected: zero lint errors in touched files.

- [ ] **Step 6: Run the existing repository verification**

Run:

```bash
npm run lint
npm test
npm run build
npx tsc --noEmit --pretty false
```

Expected:

- lint and production build pass;
- tests unrelated to initial `/call` bootstrap/mode behavior pass;
- `CallBootstrapScreen.test.ts` auto-join cases and `VideoCallScreen.test.tsx` initial Voice/Video cases may fail because their assertions are intentionally stale and test edits are forbidden;
- TypeScript has no new application errors; separately list any pre-existing test-fixture errors.

Do not claim the full suite is green if these stale tests fail.

- [ ] **Step 7: Review scope and secrets before the final commit**

Run:

```bash
git diff --check
git status --short
git diff --name-only HEAD~5..HEAD
git diff | rg -n "api_key|Authorization|Bearer|agora_token|session-token" || true
```

Expected: only the planned application files and docs are present; no `.env` files, cookies, tokens, or generated `.superpowers/` companion files are staged.

- [ ] **Step 8: Commit any QA-only polish**

If Task 6 caused code edits:

```bash
git add src/screens/TeacherDemoLandingScreen.tsx src/screens/CallBootstrapScreen.tsx src/screens/VideoCallScreen.tsx src/components/TranscriptDrawer.tsx src/components/TranscriptSidePanel.tsx src/components/teacher/TeacherStage.tsx src/hooks/useTeacherBoardSession.ts
git commit -m "fix: polish cinematic teacher demo"
```

If no files changed during QA, do not create an empty commit.

---

## Completion Report

The final handoff must include:

- feature branch and worktree path;
- commit list created by this plan;
- concise description of the landing, explicit join, default Teacher Mode, and transcript drawer;
- confirmation that the agent still starts only through `Start agent`;
- manual QA viewport coverage;
- exact lint, test, build, and TypeScript outcomes;
- explicit stale-test failures caused by the no-test-edit constraint;
- confirmation that no environment variables or dependencies were added;
- any remaining demo limitations.
