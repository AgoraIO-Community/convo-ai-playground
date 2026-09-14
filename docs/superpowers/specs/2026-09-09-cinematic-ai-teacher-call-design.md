# Cinematic AI Teacher Call Experience Design

**Date:** 2026-09-09

**Branch:** `feature/ai-teacher-excalidraw-prototype`

**Status:** Approved in chat

## Goal

Turn `/call` into a focused, presentation-ready AI Teacher experience without removing the existing call capabilities. A visitor first sees a cinematic product landing screen with a live Photosynthesis board preview. After entering the classroom, the call dashboard opens directly in Teacher Mode with the blackboard taking visual priority, the transcript initially collapsed, and the agent waiting for the visitor to start it explicitly.

The experience should demonstrate what Agora Conversational AI can enable for online-teaching companies: natural conversation, learner interruption, an expressive avatar, and synchronized visual explanations.

## Experience Principles

- The product proof is the live board, not a stock image or prerecorded video.
- The landing screen feels cinematic and purposeful, while the active classroom remains readable and task-focused.
- Joining the call and starting the agent are separate, explicit actions.
- Teacher Mode is the default presentation, but Voice Agent and Video Agent remain available.
- The blackboard is the primary surface. Transcript and chat are available on demand without permanently reducing board width.
- Decorative movement is subtle and respects reduced-motion preferences.

## Route State Model

`/call` uses the following page-level states:

```text
landing -> joining -> active
   ^          |
   +-- retry <-+-- error
```

### Landing

- The page does not create or join an Agora RTC/RTM session on initial render.
- The visitor sees the dedicated AI Teacher landing experience.
- The primary action is `Enter the classroom`.
- Sign-out remains available but visually secondary.

### Joining

- Clicking the primary action begins the existing call bootstrap flow.
- The landing composition remains visible while joining.
- The primary action becomes disabled and shows concise connection progress.
- The generic meeting-loading skeleton is not shown during this route flow.

### Error

- Join errors appear inside the landing composition rather than replacing it.
- The visitor can retry joining or sign out.
- Error copy is clear and does not expose raw credentials, tokens, or internal payloads.

### Active

- After a successful join, the existing call dashboard renders.
- If the application already has an active call session during an in-app remount, it can proceed directly to the active state rather than showing the landing again.
- The agent is not started automatically. The existing `Start agent` action remains the explicit next step.

## Cinematic Landing Screen

Create a route-specific landing component, recommended as `TeacherDemoLandingScreen`, and use it from `CallBootstrapScreen`.

### Composition

- Use a dark, near-black canvas with restrained cyan and indigo atmospheric light.
- On desktop, use an editorial split layout: product story and actions on the left, live classroom preview on the right.
- On small screens, stack the story above the preview and keep the primary action visible without horizontal scrolling.
- Prefer dimensional gradients, fine grid details, and controlled glow over stock photography.

### Content

- Product label: `AI Teacher`.
- Primary message: `Teach anything. Make it visible.`
- Supporting idea: `The classroom, reimagined` or equivalent concise language.
- Capability chips:
  - `Speak naturally`
  - `Interrupt anytime`
  - `Visual explanations`
- Primary action: `Enter the classroom`.
- Exact footer branding: `Powered by Agora Conversational AI`.

### Live preview

- Reuse the existing Excalidraw-based Photosynthesis demo and `TeacherStage`; do not add a video asset.
- Run the preview locally and silently. It must not create an AI agent or Agora call.
- Autoplay the lesson and loop it so the landing continuously demonstrates labels, shapes, connectors, and progressive explanation.
- The preview may include a presentation-only avatar tile to communicate the final classroom composition. It must not imply that a live agent has already joined.
- Suggested-lesson prompts may be shown as product examples, but they do not start a session or preconfigure the eventual agent.
- If motion is reduced, show a representative completed board or a non-looping state.

## Active Classroom Layout

### Default mode

- Initialize the active dashboard in `teacher` mode, independent of the current microphone or camera state.
- Render the teacher blackboard and avatar picture-in-picture immediately after joining.
- Preserve the existing Voice Agent and Video Agent experiences and allow the visitor to switch away from Teacher Mode.
- Settings remain accessible before the agent starts so the visitor can review or change the avatar, voice, model, and other existing configuration.

### Agent lifecycle

- Joining the classroom does not create/start the AI agent.
- The board can be ready before the agent starts, while the avatar remains a non-speaking preview or empty state according to existing media availability.
- Clicking `Start agent` uses the existing configured agent creation flow, including avatar and teacher orchestration.
- Once started, the existing lesson Director controls synchronized board cues and speech. The landing preview does not participate in the live lesson.

### Header and controls

- Clearly identify `AI Teacher` or `Teacher Mode` in the active experience.
- Retain essential call controls, connection status, elapsed time, agent start/stop, and settings.
- Retain access to Voice Agent and Video Agent without making those modes the initial focus.
- Use the same restrained cyan/indigo visual language as the landing so the transition feels continuous.

## Transcript Drawer

The transcript is available but closed by default on desktop and mobile.

### Closed state

- The board uses the full available classroom width.
- A persistent, discoverable left-edge trigger labeled `Transcript` opens the panel.
- The trigger exposes `aria-expanded` and `aria-controls` state.

### Open state

- Reuse `TranscriptSidePanel`, including render modes, history, chat/instruct controls, image input, and message input.
- Present it as a left slide-over drawer above the classroom rather than as a permanent layout column.
- Opening the drawer must not recalculate or shrink the board canvas.
- On mobile, the drawer is near full width while leaving enough surrounding context to communicate that it overlays the classroom.
- Provide an obvious close chevron/button.
- `Escape` closes the drawer.
- Move focus into the drawer when it opens and return focus to the trigger when it closes.
- If reduced motion is enabled, open and close without the sliding transition.

## Data and Component Responsibilities

### `CallBootstrapScreen`

- Owns `landing`, `joining`, `active`, and join-error presentation.
- Defers the existing join call until the visitor clicks the primary action.
- Keeps the landing component mounted during joining and inline errors.
- Passes the existing joined-call context into `VideoCallScreen` without altering transport behavior.

### `TeacherDemoLandingScreen`

- Owns only presentation and the local Photosynthesis preview lifecycle.
- Receives join state, error state, and CTA callbacks from `CallBootstrapScreen`.
- Does not own Agora credentials, create agents, or modify saved settings.

### `VideoCallScreen`

- Defaults the experience mode to `teacher`.
- Owns the transcript drawer open/closed state, initially `false`.
- Preserves existing call, agent, media, avatar, MCP, and settings behavior.

### `TranscriptSidePanel`

- Continues to own transcript and messaging UI.
- May receive a small presentation extension for drawer focus/close behavior, but its data and chat behavior remain unchanged.

### Teacher preview reuse

- Reuse `useTeacherBoardSession`, `TeacherStage`, and `PHOTOSYNTHESIS_DEMO` rather than duplicating board commands.
- Any loop controller belongs to the landing preview and is disposed when the page leaves the landing state.

## Responsive and Accessibility Requirements

- At common desktop widths, the landing split and active full-board layout fit without page-level horizontal scrolling.
- At tablet and mobile widths, landing content stacks and the board remains usable behind the transcript drawer.
- All primary controls are keyboard reachable and have visible focus states.
- The transcript trigger, close button, join action, retry action, and agent controls have accessible names.
- Decorative backgrounds do not reduce text contrast.
- `prefers-reduced-motion` disables ambient animation, demo looping transitions, and drawer sliding while keeping all content and controls available.

## Preservation Requirements

- Preserve Weather MCP, Teacher MCP, saved MCP entries, avatar configuration, voice/model settings, and all existing settings behavior.
- Preserve the deterministic Teacher Lesson Director as the live drawing path.
- Preserve the current agent creation and stop lifecycle.
- Preserve normal Voice Agent and Video Agent modes.
- Keep all work in the existing feature worktree and branch; do not modify `main`.

## Out of Scope

- Adding or hosting a prerecorded Photosynthesis video.
- Automatically starting an AI agent from the landing CTA.
- Automatically changing a visitor's saved avatar, voice, model, or MCP settings.
- Redesigning routes other than `/call`.
- Avatar hand tracking or phoneme-level drawing synchronization.
- External image generation for lesson boards.
- Replacing the existing Teacher Lesson Director with an MCP-only drawing architecture.

## Verification

Per the project instruction, do not add or modify automated test files. Verify the change by running the existing checks and by rendered manual QA.

### Existing checks

- Run the existing lint command.
- Run the existing test suite without adding tests.
- Run the production build.
- Run the existing TypeScript check and distinguish pre-existing fixture errors from new application errors.

### Manual rendered QA

- Confirm `/call` initially shows the cinematic teacher landing, not the generic meeting skeleton.
- Confirm the live Photosynthesis board preview plays without creating a call or agent.
- Confirm `Enter the classroom` joins the call and preserves the landing while connecting.
- Confirm join errors are recoverable through the inline Retry action.
- Confirm the active dashboard opens in Teacher Mode with the transcript closed.
- Confirm the agent remains stopped until `Start agent` is clicked.
- Confirm settings can be opened before starting the agent.
- Confirm the transcript trigger opens a non-resizing overlay drawer and that its close button and `Escape` work.
- Confirm Voice Agent and Video Agent remain usable.
- Confirm desktop, tablet, and mobile layouts visually.
- Confirm reduced-motion behavior.

## Acceptance Criteria

1. Navigating to `/call` shows a polished AI Teacher landing experience with exact `Powered by Agora Conversational AI` branding.
2. The landing preview reuses and loops the live Photosynthesis Excalidraw demo without joining Agora or creating an agent.
3. Clicking `Enter the classroom` begins joining while keeping the landing visible and showing connection progress.
4. A successful join opens the current call dashboard directly in Teacher Mode.
5. The AI agent does not start until the visitor explicitly clicks `Start agent`.
6. The transcript is closed by default and opens as an accessible left slide-over without reducing board width.
7. The transcript drawer works at desktop and mobile sizes and closes by button or `Escape`.
8. Settings, avatar behavior, Teacher Director, Weather MCP, Teacher MCP, Voice Agent, and Video Agent continue to work.
9. The page remains coherent and usable with reduced motion enabled.
10. Existing verification passes with no new automated tests added.
