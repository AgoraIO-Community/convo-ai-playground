# Voice and Video Agent Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add accurate OpenAI managed/BYOK model controls and a polished, session-preserving Voice Agent / Video Agent call experience with professional agent iconography.

**Architecture:** `VideoCallScreen` owns a session-local presentation mode and changes it only after an idempotent Agora camera publication operation succeeds. Voice and video stages share the existing RTC/RTM session, agent state, transcript, and controls. OpenAI model data moves to one independent catalog module consumed by both settings presets and Agora managed-provider normalization.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.8 strict mode, Zustand 5, Tailwind CSS 4, Agora RTC Web 4.24.3, Vitest 4, Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-27-voice-video-agent-experience-design.md`

## Global Constraints

- Preserve the existing RTC/RTM session, active agent, transcript, timer, telephony, authentication, and API payload contracts.
- Managed OpenAI must expose exactly `gpt-4o-mini`, `gpt-4.1-mini`, `gpt-5-nano`, and `gpt-5-mini`.
- BYOK OpenAI must allow the curated current Chat Completions list plus an exact custom model ID.
- Do not copy ChatGPT/OpenAI visual assets. Use the approved navy/cyan signal-glyph direction.
- Use primitive Zustand selectors and memoized callbacks.
- Mode changes are successful only after camera publish/unpublish succeeds.
- Continuous animation must stop under `prefers-reduced-motion: reduce`.
- Use `apply_patch` for source edits and keep each task in its own commit.

---

## Task 1: Centralize and validate OpenAI model catalogs

**Files:**

- Create: `src/lib/agora/openAIModels.ts`
- Create: `src/lib/agora/openAIModels.test.ts`
- Modify: `src/lib/agora/managedProviders.ts`
- Modify: `src/lib/agora/managedProviders.test.ts`
- Modify: `src/types/agora.ts`

### Steps

- [ ] Add failing catalog tests covering the exact managed list, curated BYOK inclusions/exclusions, unknown stored IDs, and empty custom IDs.

```ts
import { describe, expect, it } from "vitest";
import {
  OPENAI_BYOK_MODEL_IDS,
  OPENAI_MANAGED_MODEL_IDS,
  OPENAI_CUSTOM_MODEL_VALUE,
  getOpenAIModelControlValue,
  resolveOpenAIModelValue,
} from "./openAIModels";

describe("OpenAI model catalogs", () => {
  it("keeps Agora-managed OpenAI support exact", () => {
    expect(OPENAI_MANAGED_MODEL_IDS).toEqual([
      "gpt-4o-mini",
      "gpt-4.1-mini",
      "gpt-5-nano",
      "gpt-5-mini",
    ]);
  });

  it("offers current Chat Completions models without unrelated families", () => {
    expect(OPENAI_BYOK_MODEL_IDS).toEqual(
      expect.arrayContaining([
        "gpt-5.6-sol",
        "gpt-5.6-terra",
        "gpt-5.6-luna",
        "gpt-5.5",
        "gpt-5.4-mini",
        "gpt-4.1-mini",
        "gpt-4o-mini",
      ]),
    );
    expect(OPENAI_BYOK_MODEL_IDS).not.toEqual(
      expect.arrayContaining([
        "gpt-realtime",
        "gpt-image-1",
        "gpt-4o-transcribe",
        "codex-mini-latest",
        "gpt-3.5-turbo",
      ]),
    );
  });

  it("reopens an unknown stored model as a custom model", () => {
    expect(getOpenAIModelControlValue("gpt-5.7-preview")).toBe(
      OPENAI_CUSTOM_MODEL_VALUE,
    );
    expect(resolveOpenAIModelValue(OPENAI_CUSTOM_MODEL_VALUE, "  vendor-id  ")).toEqual({
      ok: true,
      value: "vendor-id",
    });
    expect(resolveOpenAIModelValue(OPENAI_CUSTOM_MODEL_VALUE, " ")).toEqual({
      ok: false,
      error: "Enter a custom OpenAI model ID.",
    });
  });
});
```

- [ ] Run the new test and confirm it fails because the catalog module does not exist.

Run: `npm test -- --run src/lib/agora/openAIModels.test.ts`

Expected: FAIL with a module-resolution error for `./openAIModels`.

- [ ] Implement the dependency-free model catalog and custom-model helpers.

```ts
export const OPENAI_MANAGED_MODEL_IDS = [
  "gpt-4o-mini",
  "gpt-4.1-mini",
  "gpt-5-nano",
  "gpt-5-mini",
] as const;

export const OPENAI_BYOK_MODEL_IDS = [
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  "gpt-5.5",
  "gpt-5.5-pro",
  "gpt-5.4",
  "gpt-5.4-pro",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
  "gpt-5.2",
  "gpt-5.1",
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4o",
  "gpt-4o-mini",
] as const;

export const OPENAI_MANAGED_DEFAULT_MODEL = "gpt-5-mini";
export const OPENAI_BYOK_DEFAULT_MODEL = "gpt-5.6-terra";
export const OPENAI_CUSTOM_MODEL_VALUE = "__custom_openai_model__";

export function isCuratedOpenAIByokModel(model: string): boolean {
  return OPENAI_BYOK_MODEL_IDS.some((candidate) => candidate === model);
}

export function getOpenAIModelControlValue(model: string): string {
  return isCuratedOpenAIByokModel(model)
    ? model
    : OPENAI_CUSTOM_MODEL_VALUE;
}

export function resolveOpenAIModelValue(
  selectedValue: string,
  customValue: string,
): { ok: true; value: string } | { ok: false; error: string } {
  if (selectedValue !== OPENAI_CUSTOM_MODEL_VALUE) {
    return { ok: true, value: selectedValue };
  }
  const value = customValue.trim();
  return value
    ? { ok: true, value }
    : { ok: false, error: "Enter a custom OpenAI model ID." };
}
```

- [ ] Replace the inline managed models in `managedProviders.ts` with the managed constants and keep normalization/default behavior unchanged.

- [ ] Replace only `LLM_PRESETS.openai.defaultModel` and `.models` in `types/agora.ts` with the BYOK constants. Do not alter Azure OpenAI or any other vendor preset.

- [ ] Update the managed-provider tests so they still assert the exact four-model contract through the shared catalog.

- [ ] Run focused tests.

Run: `npm test -- --run src/lib/agora/openAIModels.test.ts src/lib/agora/managedProviders.test.ts`

Expected: PASS.

- [ ] Commit.

```bash
git add src/lib/agora/openAIModels.ts src/lib/agora/openAIModels.test.ts src/lib/agora/managedProviders.ts src/lib/agora/managedProviders.test.ts src/types/agora.ts
git commit -m "feat: refresh OpenAI model catalogs"
```

---

## Task 2: Add BYOK custom model behavior to agent settings

**Files:**

- Modify: `src/components/SettingsSidebar.tsx`
- Modify: `src/components/SettingsSidebar.test.tsx`

### Steps

- [ ] Add failing tests for the BYOK curated list, custom selection, empty custom validation, and reopening a stored unknown model.

```tsx
it("supports a validated custom OpenAI BYOK model ID", async () => {
  const onSave = vi.fn<(settings: AgentSettings) => void>();
  render(
    <SettingsSidebar
      isOpen
      onClose={() => undefined}
      onSaveAgentSettings={onSave}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /LLM Configuration/i }));
  chooseFromField("Model", "Custom model ID");
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(screen.getByText("Enter a custom OpenAI model ID.")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Custom OpenAI model ID"), {
    target: { value: "gpt-5.7-preview" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));

  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  expect(onSave.mock.calls[0][0].llm.params?.model).toBe("gpt-5.7-preview");
});
```

- [ ] Run the focused test and confirm the custom option/input assertions fail.

Run: `npm test -- --run src/components/SettingsSidebar.test.tsx`

Expected: FAIL because the custom model control is not rendered.

- [ ] In `AgentSettingsSidebarContent`, derive the OpenAI BYOK control value from the persisted model rather than adding a second source of truth.

```ts
const isOpenAIByok = !llmManaged && selectedLLMVendor === "openai";
const persistedLLMModel = settings.llm.params?.model ?? "";
const llmModelControlValue = isOpenAIByok
  ? getOpenAIModelControlValue(persistedLLMModel)
  : persistedLLMModel;
const customOpenAIModel =
  isOpenAIByok && llmModelControlValue === OPENAI_CUSTOM_MODEL_VALUE
    ? persistedLLMModel
    : "";
```

- [ ] Append `{ value: OPENAI_CUSTOM_MODEL_VALUE, label: "Custom model ID" }` only when vendor is OpenAI and credential mode is BYOK.

- [ ] When custom is selected, render a labeled text input under the model selector. Store the exact typed ID in `settings.llm.params.model`.

- [ ] Track a local validation message only for an empty custom ID. In `handleApply`, call `resolveOpenAIModelValue`; show the inline message and existing error toast before `validateAgentSettings` or `onSave`.

- [ ] Ensure changing from a custom ID to a curated ID clears the custom error; switching to managed mode continues to normalize to `gpt-5-mini` and strips credentials.

- [ ] Run the settings tests.

Run: `npm test -- --run src/components/SettingsSidebar.test.tsx src/lib/agora/openAIModels.test.ts`

Expected: PASS.

- [ ] Commit.

```bash
git add src/components/SettingsSidebar.tsx src/components/SettingsSidebar.test.tsx
git commit -m "feat: support custom OpenAI BYOK models"
```

---

## Task 3: Make camera publication idempotent

**Files:**

- Modify: `src/hooks/useAgora.ts`
- Modify: `src/hooks/useAgora.test.ts`

### Steps

- [ ] Add failing hook tests for explicit enable, explicit disable, no-op requests, and publication failure.

```ts
it("sets local video publication idempotently", async () => {
  const { useAgora } = await import("./useAgora");
  const { result } = renderHook(() => useAgora());
  await act(async () => result.current.joinMeeting(session, false));

  await act(async () => result.current.setLocalVideoEnabled(false));
  expect(mocks.rtcClient.unpublish).toHaveBeenCalledWith(mocks.videoTrack);
  expect(useAppStore.getState().videoMuted).toBe(true);

  mocks.rtcClient.unpublish.mockClear();
  await act(async () => result.current.setLocalVideoEnabled(false));
  expect(mocks.rtcClient.unpublish).not.toHaveBeenCalled();

  await act(async () => result.current.setLocalVideoEnabled(true));
  expect(mocks.createCameraVideoTrack).toHaveBeenCalledTimes(2);
  expect(mocks.rtcClient.publish).toHaveBeenLastCalledWith(mocks.videoTrack);
  expect(useAppStore.getState().videoMuted).toBe(false);
});
```

- [ ] Reset the Zustand media state in test `beforeEach` so tests do not leak mute state.

- [ ] Run the hook test and confirm the missing-method failure.

Run: `npm test -- --run src/hooks/useAgora.test.ts`

Expected: FAIL because `setLocalVideoEnabled` is not returned.

- [ ] Implement `setLocalVideoEnabled(enabled: boolean)` as the authoritative operation.

```ts
const setLocalVideoEnabled = useCallback(async (enabled: boolean): Promise<void> => {
  const state = useAppStore.getState();
  const currentlyEnabled = !state.videoMuted && Boolean(localVideoTrack);
  if (currentlyEnabled === enabled) return;

  if (enabled) {
    const nextTrack = await AgoraRTC.createCameraVideoTrack();
    try {
      await getRtcClient().publish(nextTrack);
    } catch (error) {
      releaseAgoraTrack(nextTrack);
      throw error;
    }
    localVideoTrack = nextTrack;
    state.setLocalTracks(localAudioTrack, nextTrack);
    if (useAppStore.getState().videoMuted) state.toggleVideoMute();
    return;
  }

  if (localVideoTrack) {
    await getRtcClient().unpublish(localVideoTrack);
    releaseAgoraTrack(localVideoTrack);
    localVideoTrack = null;
    state.setLocalTracks(localAudioTrack, null);
  }
  if (!useAppStore.getState().videoMuted) state.toggleVideoMute();
}, []);
```

- [ ] Reimplement `toggleLocalVideo` as `setLocalVideoEnabled(useAppStore.getState().videoMuted)` to retain the public API used by the camera button.

- [ ] Return `setLocalVideoEnabled` from the hook.

- [ ] Confirm that a rejected create/publish leaves the old track/store state intact and that a rejected unpublish does not flip `videoMuted`.

- [ ] Run the hook tests.

Run: `npm test -- --run src/hooks/useAgora.test.ts`

Expected: PASS.

- [ ] Commit.

```bash
git add src/hooks/useAgora.ts src/hooks/useAgora.test.ts
git commit -m "refactor: make camera publication explicit"
```

---

## Task 4: Build the professional agent visual primitives

**Files:**

- Create: `src/components/AgentGlyph.tsx`
- Create: `src/components/AgentGlyph.test.tsx`
- Create: `src/components/VoiceAgentStage.tsx`
- Create: `src/components/VoiceAgentStage.test.tsx`
- Modify: `app/globals.css`

### Steps

- [ ] Add failing tests for accessible state labels and transport-aware visual-state mapping.

```tsx
it.each([
  [EAgentState.IDLE, "Idle", "idle"],
  [EAgentState.LISTENING, "Listening", "listening"],
  [EAgentState.THINKING, "Thinking", "thinking"],
  [EAgentState.SPEAKING, "Speaking", "speaking"],
  [EAgentState.SILENT, "Silent", "silent"],
])("maps %s to an accessible %s state", (agentState, label, visualState) => {
  render(
    <VoiceAgentStage
      agentName="Maya"
      agentState={agentState}
      isAgentActive
      transcriptionMode="rtm"
    />,
  );
  expect(screen.getByText(label)).toHaveAttribute("aria-live", "polite");
  expect(screen.getByTestId("voice-agent-orb")).toHaveAttribute(
    "data-agent-visual-state",
    visualState,
  );
});

it("does not invent an RTM state in RTC-only mode", () => {
  render(
    <VoiceAgentStage
      agentName="Maya"
      agentState={EAgentState.SPEAKING}
      isAgentActive
      transcriptionMode="rtc"
    />,
  );
  expect(screen.getByText("Connected")).toBeInTheDocument();
  expect(screen.queryByText("Speaking")).not.toBeInTheDocument();
});
```

- [ ] Run the component tests and confirm missing-module failures.

Run: `npm test -- --run src/components/AgentGlyph.test.tsx src/components/VoiceAgentStage.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] Implement `AgentGlyph` as a reusable inline SVG with waveform/signal geometry and these props.

```ts
export type AgentGlyphSize = "compact" | "control" | "navigation" | "stage";

export interface AgentGlyphProps {
  size?: AgentGlyphSize;
  className?: string;
  decorative?: boolean;
}
```

The SVG must use `currentColor`, no face/eyes, and `aria-hidden` when decorative. Do not include copied brand paths.

- [ ] Implement `VoiceAgentStage` with props:

```ts
interface VoiceAgentStageProps {
  agentName: string;
  agentState: EAgentState;
  isAgentActive: boolean;
  transcriptionMode: "rtc" | "rtm";
  compact?: boolean;
  avatarWaiting?: boolean;
}
```

Map inactive to `Ready`, active RTC-only to `Connected`, and active RTM to the real agent state. Render concentric decorative layers plus the glyph and keep the label accessible.

- [ ] Add CSS keyframes/classes for breathing, inward ripple, orbital thinking, and outward speaking. Limit animation to `transform` and `opacity`.

- [ ] Add a reduced-motion block:

```css
@media (prefers-reduced-motion: reduce) {
  .voice-agent-motion,
  .voice-agent-motion::before,
  .voice-agent-motion::after {
    animation: none !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] Run focused tests.

Run: `npm test -- --run src/components/AgentGlyph.test.tsx src/components/VoiceAgentStage.test.tsx`

Expected: PASS.

- [ ] Commit.

```bash
git add src/components/AgentGlyph.tsx src/components/AgentGlyph.test.tsx src/components/VoiceAgentStage.tsx src/components/VoiceAgentStage.test.tsx app/globals.css
git commit -m "feat: add professional voice agent stage"
```

---

## Task 5: Add the accessible Voice Agent / Video Agent mode switch

**Files:**

- Create: `src/types/callExperience.ts`
- Create: `src/components/CallExperienceModeSwitch.tsx`
- Create: `src/components/CallExperienceModeSwitch.test.tsx`

### Steps

- [ ] Add a failing interaction test.

```tsx
it("exposes an accessible exclusive voice/video choice", () => {
  const onChange = vi.fn();
  render(
    <CallExperienceModeSwitch value="voice" onChange={onChange} />,
  );

  expect(screen.getByRole("radio", { name: "Voice Agent" })).toBeChecked();
  fireEvent.click(screen.getByRole("radio", { name: "Video Agent" }));
  expect(onChange).toHaveBeenCalledWith("video");
});
```

- [ ] Run the test and confirm missing-module failure.

Run: `npm test -- --run src/components/CallExperienceModeSwitch.test.tsx`

Expected: FAIL.

- [ ] Define `export type CallExperienceMode = "voice" | "video"`.

- [ ] Implement the switch as a compact header `radiogroup` with two single-line radio buttons, clear selected state, focus-visible rings, and `disabled`/busy support.

```ts
interface CallExperienceModeSwitchProps {
  value: CallExperienceMode;
  onChange: (mode: CallExperienceMode) => void;
  disabled?: boolean;
}
```

- [ ] Run the focused test.

Run: `npm test -- --run src/components/CallExperienceModeSwitch.test.tsx`

Expected: PASS.

- [ ] Commit.

```bash
git add src/types/callExperience.ts src/components/CallExperienceModeSwitch.tsx src/components/CallExperienceModeSwitch.test.tsx
git commit -m "feat: add call experience mode switch"
```

---

## Task 6: Integrate voice/video modes without restarting the session

**Files:**

- Modify: `src/screens/VideoCallScreen.tsx`
- Modify: `src/screens/VideoCallScreen.test.tsx`
- Modify: `src/components/Controls.tsx`
- Modify: `src/components/Controls.test.ts`
- Modify: `src/components/AgentTile.tsx`

### Steps

- [ ] Extend the screen tests so the `useAgora`, stage, mode-switch, video-tile, and controls mocks expose their props.

- [ ] Add failing tests for initial mode, successful transitions, failed transitions, and session preservation.

```tsx
it("starts in voice mode when camera is unpublished", () => {
  useAppStore.setState({ videoMuted: true, isAgentActive: true });
  render(<VideoCallScreen />);
  expect(screen.getByTestId("voice-agent-stage")).toBeInTheDocument();
  expect(latestControlsProps.experienceMode).toBe("voice");
});

it("publishes camera before entering video mode", async () => {
  mocks.setLocalVideoEnabled.mockResolvedValue(undefined);
  render(<VideoCallScreen />);
  fireEvent.click(screen.getByRole("radio", { name: "Video Agent" }));
  await waitFor(() =>
    expect(mocks.setLocalVideoEnabled).toHaveBeenCalledWith(true),
  );
  expect(screen.getByTestId("local-video-stage")).toBeInTheDocument();
});

it("stays in voice mode when camera publication fails", async () => {
  mocks.setLocalVideoEnabled.mockRejectedValue(new Error("Permission denied"));
  render(<VideoCallScreen />);
  fireEvent.click(screen.getByRole("radio", { name: "Video Agent" }));
  await waitFor(() => expect(mocks.showToast).toHaveBeenCalled());
  expect(screen.getByTestId("voice-agent-stage")).toBeInTheDocument();
});
```

- [ ] Update `Controls.test.ts` to pass `experienceMode` and assert four primary buttons in voice mode and five in video mode. Continue asserting the existing start-agent, settings, end-call, RTC delivery, and cleanup behavior.

- [ ] Run focused screen/control tests and confirm failures.

Run: `npm test -- --run src/screens/VideoCallScreen.test.tsx src/components/Controls.test.ts`

Expected: FAIL because the props and stage switching do not exist.

- [ ] In `VideoCallScreen`, derive the mode once from initial camera state and add guarded async switching.

```ts
const initialVideoMutedRef = useRef(videoMuted);
const [callExperienceMode, setCallExperienceMode] = useState<CallExperienceMode>(
  initialVideoMutedRef.current ? "voice" : "video",
);
const [isModeChanging, setIsModeChanging] = useState(false);

const handleExperienceModeChange = useCallback(
  async (nextMode: CallExperienceMode): Promise<void> => {
    if (nextMode === callExperienceMode || isModeChanging) return;
    setIsModeChanging(true);
    try {
      await setLocalVideoEnabled(nextMode === "video");
      setCallExperienceMode(nextMode);
    } catch (error) {
      showToast(
        nextMode === "video"
          ? "Unable to start the camera. Check browser permission and device availability."
          : "Unable to switch to voice mode.",
        "error",
      );
    } finally {
      setIsModeChanging(false);
    }
  }, [callExperienceMode, isModeChanging, setLocalVideoEnabled],
);
```

- [ ] Put `CallExperienceModeSwitch` in the header, not the media-control row.

- [ ] Voice mode renders `VoiceAgentStage` as the center hero even before the agent starts, using the configured/default agent name and live state when active.

- [ ] Video mode renders the local video as the hero. If an avatar track exists, render the existing `AgentTile` beside it. If the agent is active but has no avatar track, render a compact `VoiceAgentStage` companion instead of the old cyan robot tile.

- [ ] Change `ControlsProps` to include:

```ts
experienceMode: CallExperienceMode;
```

Keep the camera mute button only when `experienceMode === "video"`. Mode switching remains owned by the header switch.

- [ ] Replace `MdSmartToy` in the agent start/stop control with `AgentGlyph`; retain `MdSync` while loading/updating.

- [ ] In `AgentTile`, keep avatar playback and live-state pill behavior. For the no-video fallback, delegate to `VoiceAgentStage compact` or render the shared `AgentGlyph`; remove the face-like robot SVG.

- [ ] Confirm the mode switch does not call `clearAgent`, mutate transcript data, recreate RTM, or navigate.

- [ ] Run focused integration tests.

Run: `npm test -- --run src/screens/VideoCallScreen.test.tsx src/components/Controls.test.ts src/components/VoiceAgentStage.test.tsx src/hooks/useAgora.test.ts`

Expected: PASS.

- [ ] Commit.

```bash
git add src/screens/VideoCallScreen.tsx src/screens/VideoCallScreen.test.tsx src/components/Controls.tsx src/components/Controls.test.ts src/components/AgentTile.tsx
git commit -m "feat: add voice and video agent modes"
```

---

## Task 7: Refine settings navigation and agent iconography

**Files:**

- Modify: `src/components/SettingsSidebar.tsx`
- Modify: `src/components/SettingsSidebar.test.tsx`
- Modify: `src/components/AgentSettingsSidebar.tsx`

### Steps

- [ ] Add failing settings tests that assert single-line tab labels, an accessible selected tab, and the professional glyph in the AI Agent tab.

```tsx
it("keeps settings navigation compact and non-wrapping", () => {
  render(
    <SettingsSidebar
      isOpen
      onClose={() => undefined}
      onSaveAgentSettings={() => undefined}
    />,
  );
  const aiTab = screen.getByRole("tab", { name: "AI Agent" });
  expect(aiTab).toHaveAttribute("aria-selected", "true");
  expect(aiTab).toHaveClass("whitespace-nowrap");
  expect(screen.getByTestId("settings-tab-list")).toHaveClass("overflow-x-auto");
  expect(within(aiTab).getByTestId("agent-glyph")).toBeInTheDocument();
});
```

- [ ] Run the settings test and confirm the semantic/style assertions fail.

Run: `npm test -- --run src/components/SettingsSidebar.test.tsx`

Expected: FAIL.

- [ ] Change the tab strip to `role="tablist"`, each tab to `role="tab"`, and add `aria-selected`. Keep the row horizontally scrollable and add `shrink-0 whitespace-nowrap` to every tab.

- [ ] Replace `MdSmartToy` with `AgentGlyph size="navigation"` in the AI Agent tab. Use one consistent outlined Material icon family for Voice, MCP Server, and Telephony, all at the same optical size.

- [ ] Use restrained active/inactive colors, consistent focus-visible treatment, and align icon/label baselines without changing tab content or persistence.

- [ ] Replace the bot-style icons on active LLM/agent section headers in `SettingsSidebar.tsx` with the shared agent glyph where semantically appropriate. Mirror this one-line icon substitution in the legacy `AgentSettingsSidebar.tsx` so later reuse does not restore the childish icon. Do not refactor or otherwise modify the duplicate legacy form.

- [ ] Ensure all section buttons have `type="button"` and retain their existing badges/chevrons.

- [ ] Run settings and control tests.

Run: `npm test -- --run src/components/SettingsSidebar.test.tsx src/components/Controls.test.ts src/components/AgentGlyph.test.tsx`

Expected: PASS.

- [ ] Commit.

```bash
git add src/components/SettingsSidebar.tsx src/components/SettingsSidebar.test.tsx src/components/AgentSettingsSidebar.tsx
git commit -m "style: refine agent settings iconography"
```

---

## Task 8: Full verification and browser QA

**Files:**

- Modify only files required by verified defects found during this task.

### Steps

- [ ] Run the entire automated test suite.

Run: `npm test -- --run`

Expected: all tests pass.

- [ ] Run lint.

Run: `npm run lint`

Expected: exit code 0. If the repository's Next.js version no longer supports `next lint`, record that pre-existing script failure and run `npx eslint .` instead.

- [ ] Run a production build.

Run: `npm run build`

Expected: exit code 0 with no TypeScript errors.

- [ ] Scan for unfinished implementation markers and stale robot usage in changed call/settings files.

Run: `rg -n "TODO|TBD|FIXME|placeholder|MdSmartToy" src/components src/screens src/lib/agora`

Expected: no new placeholders; no `MdSmartToy` in `Controls.tsx` or settings navigation.

- [ ] Verify the changed type interfaces are consistent.

Run: `rg -n "CallExperienceMode|setLocalVideoEnabled|OPENAI_(MANAGED|BYOK)" src`

Expected: one shared mode type, one explicit media setter implementation, and one shared source for each model catalog.

- [ ] Start the isolated worktree on port 3000.

Run: `npm run dev -- --port 3000`

Expected: Next.js reports ready at `http://localhost:3000`.

- [ ] Using the in-app browser, verify desktop and mobile behavior:

  - Voice Agent is initially selected when camera is unpublished.
  - Voice stage is centered, subtle, readable, and visibly changes for idle/listening/thinking/speaking with RTM.
  - RTC-only mode says `Connected` and does not claim unsupported states.
  - Voice mode shows mic, end, agent, and settings controls but no camera button.
  - Video Agent requests/publishes camera and then shows the local video stage.
  - Switching back to Voice Agent unpublishes the camera without stopping the agent or clearing transcript/history.
  - Camera permission denial preserves Voice Agent mode and shows a useful toast.
  - Avatar video renders beside local video; no-avatar fallback uses the compact voice stage.
  - Settings tabs remain single-line and horizontally scroll on narrow panels.
  - AI Agent navigation/control visuals use the signal glyph, not a robot face.
  - Managed OpenAI shows exactly four Agora models; BYOK shows the curated list and custom ID path.
  - Reduced-motion emulation removes continuous orb movement while leaving labels/state visible.

- [ ] Fix only defects discovered by the verification above, add a regression test for each behavioral defect, and rerun the affected focused test before repeating the full checks.

- [ ] Review the final diff for accidental telephony, transcript, auth, API, or environment changes.

Run: `git diff --check && git diff --stat origin/main...HEAD && git status --short`

Expected: no whitespace errors, only scoped feature files plus the approved spec/plan, and a clean worktree after the final commit.

- [ ] Commit verified fixes, if any.

```bash
git add -u
git commit -m "fix: address voice video experience QA"
```

- [ ] If no fixes were necessary, do not create an empty commit.

## Definition of Done

- All automated tests, lint (or documented ESLint fallback), and production build pass.
- Camera is unpublished in Voice Agent mode and published only after a successful Video Agent transition.
- Agent/transcript/session state survives mode switches.
- OpenAI managed and BYOK options match the approved source constraints.
- Custom OpenAI BYOK model IDs round-trip exactly and cannot be saved empty.
- Voice stage and all agent entry points use the professional signal glyph.
- Settings tabs do not wrap and remain keyboard accessible.
- Desktop, mobile, camera-failure, avatar/no-avatar, RTC/RTM, and reduced-motion scenarios have been visually verified.
