# AI Teacher Mode with Excalidraw Design

**Date:** 2026-09-02

**Branch:** `feature/ai-teacher-excalidraw-prototype`
**Status:** Approved

## Goal

Add an optional AI Teacher presentation mode to the existing ConvoAI Playground without replacing or restructuring the current Voice Agent and Video Agent experiences.

Teacher Mode turns the center call stage into a dark, Excalidraw-based blackboard. The active AI teacher avatar appears as the only picture-in-picture tile at the bottom-right. The existing call header, transcript, timer, microphone, end-call, Start Agent, settings, Agora RTC/RTM session, and Conversational AI agent lifecycle remain intact.

The prototype must demonstrate both:

- a polished scripted lesson that works locally without a public MCP endpoint; and
- the command path needed for a live agent to draw through a session-bound `teacher_draw` MCP tool when the application is deployed at a public HTTPS address.

## Approved User Experience

### Entering Teacher Mode

Add a Teacher Mode toggle to the existing bottom control bar. It is a presentation-mode control, not an agent start/stop or media-mute control.

When the user activates Teacher Mode:

1. Remember whether the previous presentation was Voice Agent or Video Agent.
2. Disable and unpublish the local student camera through the existing Agora media control.
3. Change the center stage to `TeacherStage` only after camera shutdown succeeds.
4. Keep the active RTC channel, RTM connection, agent, transcript, chat, microphone, timer, and settings unchanged.
5. Show the configured remote AI avatar video as the only bottom-right picture-in-picture tile.
6. Preserve the current board scene until the call ends or the user explicitly clears it.

If camera shutdown fails, remain in the previous presentation and use the existing toast error pattern.

### Leaving Teacher Mode

When the user deactivates Teacher Mode:

1. Restore the previous Voice Agent or Video Agent presentation.
2. If the previous presentation was Video Agent, request and publish the camera using the existing media control.
3. Do not restart the agent or RTC/RTM session.
4. Keep the blackboard scene in memory so returning to Teacher Mode restores it.

If camera enablement fails while restoring Video Agent, fall back to Voice Agent and show a useful error toast. Board state remains preserved.

### Teacher Stage Layout

The visual target is the approved dark blackboard reference:

- Excalidraw fills the available center stage inside a rounded dark surface.
- The standard Excalidraw drawing toolbar is available at the top.
- AI drawings use a restrained chalk-like palette: white, cyan/blue, green, and amber.
- The remote AI teacher avatar appears at the bottom-right with a compact speaking/status badge.
- The left transcript remains visible on desktop and retains its existing mobile bottom-sheet behavior.
- The bottom call controls remain outside the board and visually stable.
- A small board connection indicator may appear without covering lesson content.

The student camera is not displayed in Teacher Mode. The bottom-right tile is exclusively the AI teacher avatar.

## Approaches Considered

### 1. Embedded Excalidraw with a board-command bridge — selected

Embed the Excalidraw React component in the current application and place a small, typed command interpreter between AI tool calls and the scene. This provides a mature drawing surface, rich graphics, student annotations, undo/redo, and export-friendly scene data while keeping the integration testable.

### 2. Custom HTML Canvas blackboard — rejected

A custom canvas offers complete rendering control but requires bespoke selection, text layout, resizing, undo/redo, accessibility, input handling, and scene serialization. That work does not improve the prototype's core teaching value.

### 3. Hosted Excalidraw MCP App — rejected for this prototype

The hosted Excalidraw MCP experience relies on an MCP App host capable of rendering the server's UI resource. The Playground currently supports normal streamable-HTTP MCP tool discovery and calls, not the additional MCP App iframe/resource-host contract. Embedding the React editor locally is more predictable and preserves full control of Agora session behavior.

## Call Stage Architecture

Extend `CallExperienceMode` from `"voice" | "video"` to `"voice" | "video" | "teacher"`.

`VideoCallScreen` remains the presentation-mode owner and remembers `previousNonTeacherMode` separately from the active mode. It selects exactly one center stage:

```text
VideoCallScreen
├── existing call header and Voice/Video switch
├── existing transcript panel or mobile sheet
├── active center stage
│   ├── VoiceAgentStage
│   ├── existing Video Agent stage
│   └── TeacherStage
│       ├── TeacherBoard
│       ├── TeacherBoardStatus
│       └── TeacherAvatarPiP
└── existing Controls plus Teacher Mode toggle
```

The header's existing Voice Agent / Video Agent segmented switch stays intact. While Teacher Mode is active, neither header segment appears selected and the bottom Teacher control carries the active pressed state. Selecting either header option exits Teacher Mode and chooses that presentation explicitly. The new bottom Teacher control is the primary way to enter or return from Teacher Mode.

## Component Boundaries

- `src/types/callExperience.ts`: adds the `teacher` presentation mode.
- `src/screens/VideoCallScreen.tsx`: owns active mode, previous non-teacher mode, and camera transition orchestration.
- `src/components/Controls.tsx`: adds the accessible Teacher Mode toggle and active/loading state.
- `src/components/CallExperienceModeSwitch.tsx`: continues to expose Voice and Video; selecting either exits Teacher Mode.
- `src/components/teacher/TeacherStage.tsx`: composes the board, status, demo controls, and avatar PiP.
- `src/components/teacher/TeacherBoard.tsx`: owns the Excalidraw API boundary and translates normalized scene state into editor updates.
- `src/components/teacher/TeacherAvatarPiP.tsx`: plays the existing remote avatar video track and renders the connection fallback.
- `src/hooks/useTeacherBoardSession.ts`: owns session bootstrap, command-stream lifecycle, sequencing, reconnection, and interruption cancellation.
- `src/lib/teacher/commands.ts`: defines and validates the command contract.
- `src/lib/teacher/boardReducer.ts`: applies commands to normalized AI-owned scene state without depending on React or Excalidraw.
- `src/lib/teacher/excalidrawAdapter.ts`: converts normalized elements into Excalidraw elements.
- `src/lib/teacher/demoLesson.ts`: contains the deterministic photosynthesis demonstration as commands, not hard-coded JSX artwork.
- `src/server/teacher/sessionBroker.ts`: prototype-only, in-process session event broker with a bounded replay buffer.
- `app/api/teacher/session/route.ts`: creates an opaque, short-lived teacher session and returns client connection details.
- `app/api/teacher/events/route.ts`: authenticated streaming endpoint for board commands.
- `app/api/teacher/mcp/route.ts`: streamable-HTTP MCP endpoint exposing `tools/list` and `tools/call` for `teacher_draw`.

The teacher subsystem must not move transcript parsing, Agora media lifecycle, agent start/stop logic, or general MCP settings into teacher components.

## Board Command Contract

The live agent sees one focused MCP tool: `teacher_draw`. The endpoint and bearer token bind the call to one teacher session, so the LLM does not choose or supply a session identifier.

The tool input contains:

- `turn_id`: stable identifier for one teaching response;
- `sequence`: monotonically increasing integer within that turn;
- `operations`: one to a bounded number of drawing operations;
- `animation`: `progressive` or `instant`, defaulting to `progressive`.

Supported operations for the prototype:

- `add_text`
- `add_rectangle`
- `add_ellipse`
- `add_diamond`
- `add_arrow`
- `add_line`
- `update_element`
- `delete_element`
- `clear_ai_elements`
- `clear_board`
- `focus_area`

Every AI-created drawable operation requires a stable `element_id`. Update and delete operations can target only AI-owned IDs. Student-created Excalidraw elements are tagged as client-owned and survive AI updates and `clear_ai_elements`. `clear_board` removes both AI and student content and is allowed only when the user explicitly asks for a complete clear; the system prompt tells the agent to prefer `clear_ai_elements`.

The prototype does not allow arbitrary scripts, HTML, embedded files, external image URLs, or unbounded free-form Excalidraw scene JSON. Coordinates, text length, operation count, colors, and element sizes are validated and capped at the server boundary.

## Blackboard State and Rendering

`boardReducer` is the source of truth for AI-owned normalized elements, processed command IDs, the active turn, and the last accepted sequence. Excalidraw remains the source of truth for immediate student edits. `TeacherBoard` merges the two ownership domains using stable element IDs and preserves student changes when AI state updates.

Progressive rendering is command-level rather than word-level:

- operations in a lesson step appear in order;
- text and shapes use a brief reveal transition;
- lines and arrows use Excalidraw's rough rendering with a short staged reveal;
- `instant` operations apply together for recovery or scene restoration;
- `prefers-reduced-motion` converts all commands to instant updates.

Exact pen-hand animation and avatar hand synchronization are not part of this prototype.

## Live MCP and Event Transport

### Session bootstrap

When the call screen starts, `useTeacherBoardSession` requests an opaque teacher session ID and call-scoped bearer token from `/api/teacher/session`. The token is held in memory, expires when the call ends or after a two-hour hard limit, and is not persisted in settings or browser storage.

### Agent configuration

When `TEACHER_MCP_PUBLIC_URL` is configured, the agent invite route appends an internal, session-bound MCP server to the runtime join payload. It does not add that internal server to the user's saved MCP settings. The MCP server is available for the agent's full lifetime, allowing the user to toggle Teacher Mode after the agent starts.

The MCP endpoint must be reachable by Agora's cloud agent over public HTTPS. A localhost-only development server is therefore not sufficient for live agent tool calls unless the developer separately provides a secure tunnel. The application will not create or manage a tunnel automatically.

When `TEACHER_MCP_PUBLIC_URL` is absent or unreachable, the Teacher stage remains usable in scripted demo mode and reports the live board connection as offline. The voice call continues normally.

### Command stream

After `teacher_draw` validates a call, the prototype session broker stamps the command with a server event ID, stores it in a bounded replay buffer, and publishes it to the matching browser stream. `useTeacherBoardSession` consumes the authenticated fetch stream and applies events in order.

On reconnect, the client sends its last processed event ID. The broker replays only newer buffered events. Duplicate event IDs and commands with a stale turn or sequence are ignored.

The in-process broker is intentionally prototype-only and assumes one long-running Node.js process. A production or horizontally scaled deployment must replace it with an external pub/sub and replay store. The browser-facing transport and command interpreter are isolated so that replacement does not change `TeacherBoard`.

## Voice, Drawing, and Interruption Flow

```text
Student speech or typed message
  -> existing Agora RTC/RTM and ConvoAI pipeline
  -> LLM selects a teaching step
  -> LLM calls session-bound teacher_draw MCP tool
  -> MCP route validates and publishes normalized commands
  -> browser session stream receives ordered event
  -> boardReducer accepts the current turn/sequence
  -> TeacherBoard applies the Excalidraw update
  -> agent continues with the spoken explanation
```

The prototype synchronizes at lesson-step granularity. The board step normally appears immediately before or as the corresponding explanation begins; word-perfect drawing-to-speech timing is not promised.

When the existing agent state changes from thinking/speaking to listening, or the call ends:

1. Cancel queued visual animations for the active turn.
2. Keep elements whose operations were already committed.
3. Mark later commands from the interrupted turn as stale.
4. Accept a new turn only when its first valid command arrives.

No completed board content is automatically rolled back on interruption. The next response may update, remove, or continue it.

## Scripted Demonstration

`demoLesson.ts` supplies the approved photosynthesis lesson through the exact same command interpreter used by live MCP events. It demonstrates:

- a title and underline;
- Sunlight, Water, and CO2 inputs;
- a central leaf/chloroplast concept;
- arrows connecting inputs and outputs;
- Glucose and O2 outputs;
- a short explanatory note;
- progressive rendering, pause, interruption, resume, undo, and clear behavior.

The demo is explicitly labeled as a local prototype lesson. A compact **Play demo lesson** control is shown only when no live board stream is connected or when development demo mode is enabled. It does not simulate a successful live MCP connection. It exists so visual behavior can be developed and verified without exposing localhost to the cloud agent.

## Avatar PiP

`TeacherAvatarPiP` reuses the existing `agentAvatarVideoTrack` and associated remote-avatar UID state. It does not create a second avatar session.

- When the track is available, play it in a 16:9 bottom-right tile.
- When the agent exists but the video track is pending, show a neutral “Teacher connecting” placeholder.
- When no avatar is configured, show the existing professional agent identity and current agent state instead of a broken or empty video element.
- The PiP remains above board content but below modal/settings layers.
- The tile is keyboard reachable only when it contains an interactive control; otherwise it is presentational with an accessible status label.

## Error Handling and Isolation

- Camera transition failure preserves the previous presentation mode.
- Excalidraw load failure exits to the previous Voice/Video stage and reports the problem through the existing toast pattern.
- MCP or command-stream failure displays a compact offline indicator; it never stops RTC, RTM, transcripts, the avatar audio, or the agent.
- Invalid, stale, duplicate, unauthorized, oversized, or unsupported commands are rejected without mutating the scene.
- A malformed operation within a batch rejects the complete batch so partial diagrams are not created accidentally.
- Stream reconnect uses bounded exponential backoff and stops when the call ends.
- Avatar video failure falls back to the professional voice-agent identity while the board remains usable.
- Ending the call destroys the teacher session, closes the stream, clears its in-memory scene, and cancels queued animations.

## Responsive and Accessibility Requirements

- Desktop preserves the existing transcript width and gives the board the remaining stage area.
- On compact layouts, the existing transcript bottom sheet remains the transcript experience; the blackboard takes the available stage.
- The board and call controls must not cause page-level horizontal overflow.
- The Teacher Mode button has an explicit accessible name, pressed state, loading state, visible focus state, and tooltip.
- Board connection and teacher state are exposed as text and do not rely on color alone.
- Excalidraw keyboard behavior remains available for student annotations.
- `prefers-reduced-motion: reduce` disables progressive reveal animations.
- The avatar PiP must not obscure the focused board region; `focus_area` accounts for a protected bottom-right inset.

## Verification Strategy

Per the user's explicit instruction, this prototype will not add automated test files or test cases and will not use a test-driven-development workflow. Implementation proceeds directly from the approved design.

Existing automated tests remain unchanged and are run as regression protection. Verification consists of:

- Run the existing test suite and confirm the current baseline remains green.
- Run lint, type-checking if separately configured, and the production build.
- Start the isolated worktree and visually verify desktop and compact layouts.
- Verify Voice -> Teacher -> Voice and Video -> Teacher -> Video transitions without restarting the agent.
- Verify the configured avatar PiP, connecting state, and no-avatar fallback.
- Play the scripted photosynthesis lesson and manually verify progressive rendering, interruption, resume, undo, clear, and annotation preservation.
- Simulate command-stream disconnect and reconnect and verify the call remains usable and duplicate commands do not appear.
- Submit malformed and stale commands manually and verify they are rejected without changing the scene.
- Inspect the runtime join payload and stored settings to confirm the internal teacher MCP configuration does not alter user-saved MCP servers.
- When a public HTTPS MCP URL and working agent credentials are available, perform one live voice-to-board round trip before claiming the live MCP path works.

## Acceptance Criteria

1. Teacher Mode can be entered and exited without restarting the call or agent.
2. The existing Playground behaves identically when Teacher Mode is off.
3. The approved photosynthesis demonstration renders progressively on the embedded blackboard.
4. The configured AI avatar is the only bottom-right PiP; the student camera is hidden.
5. Student annotations survive AI updates and AI-only clearing.
6. Interruption stops unfinished drawing animation and speech while retaining completed content.
7. Board, MCP, stream, or avatar-video failure does not break voice, transcript, or call controls.
8. Live MCP operation is reported as working only after a public endpoint is exercised end to end.
9. All work remains isolated to `feature/ai-teacher-excalidraw-prototype` and its dedicated worktree until the user chooses an integration strategy.

## Out of Scope

- Avatar hand or pen animation synchronized to strokes.
- Word-perfect speech-to-drawing timing.
- Student camera display in Teacher Mode.
- Multi-user collaborative board synchronization.
- Persistent lesson storage across calls.
- Production multi-instance event infrastructure.
- Automatic tunnel creation or application deployment.
- Arbitrary web content, remote images, code execution, or full raw Excalidraw scene injection from the LLM.
- Replacing Agora ConvoAI, RTC, RTM, transcripts, telephony, authentication, settings persistence, or existing user-configured MCP servers.
