# Mobile-Responsive Redesign — My Agora App

## Context
The app currently targets desktop only. On mobile/tablet, `VideoCallScreen` loses access to Transcript, Participants, and Agent Settings entirely (sidebars are `hidden sm:flex` with no replacement). The control bar uses fixed `space-x-6` + `w-14 h-14` buttons that overflow on phones, and the video grid uses hard-coded `grid-cols-2/3/4` with no mobile fallback. Goal: clean, native-feeling responsive layouts for phone (< 768px), tablet (768–1023px), and desktop (≥ 1024px) — **no regressions, no missing features**, polished aesthetics.

Stack: Next.js 15 + React 19 + TailwindCSS 4 + Zustand 5. No animation/sheet library — bottom sheets hand-rolled.

## Approved Design Decisions
1. **Bottom bar:** Core 4 (Mic, Camera, More •••, End Call) + a "More" bottom action-sheet for Screen Share, Whiteboard, Share Link, Switch Camera, Participants, Settings, Agent toggle.
2. **Layered panels:** Transcript, Participants, Agent Settings all become bottom sheets with snap points on mobile (50% / 90%).
3. **Sheet implementation:** Hand-rolled with Tailwind transitions + a small drag-to-dismiss touch hook. Zero new dependencies.
4. **Tablet:** Slim 280px sidebar for Transcript; Settings/Participants still as sheets.

## Breakpoints
| Range | Bucket | Behavior |
|---|---|---|
| < 768px | mobile | Bottom sheets, Core-4 bar, single-column video |
| 768–1023px | tablet | 280px Transcript sidebar, sheets for Settings/Participants |
| ≥ 1024px | desktop | **Unchanged** |

## Files to Create
- `src/hooks/useMediaQuery.ts` — SSR-safe; exports `useIsMobile()`, `useIsTablet()`, `useIsDesktop()`.
- `src/components/common/BottomSheet.tsx` — backdrop, drag handle, snap points, swipe-dismiss, ESC, focus trap, safe-area inset.
- `src/components/MoreActionsSheet.tsx` — grid of secondary actions.
- `src/components/MobileTopBar.tsx` — compact mobile header.

## Files to Modify
- `src/screens/VideoCallScreen.tsx` — mobile/tablet branches; mobile video grid; sheet-based panels.
- `src/components/Controls.tsx` — mobile branch with Core 4; desktop unchanged.
- `src/components/TranscriptSidePanel.tsx` — `asSheet` prop support.
- `src/components/SettingsSidebar.tsx` — render inside BottomSheet on mobile.
- `src/screens/CreateMeetingScreen.tsx`, `JoinMeetingScreen.tsx`, `LandingScreen.tsx` — `min-h-[100dvh]`, safe-area.
- `src/app/globals.css` (or `index.css`) — `100dvh` utility, sheet keyframes, prefers-reduced-motion.

## Build Sequence
1. `useMediaQuery` + `BottomSheet` (foundation)
2. Refactor `Controls.tsx` — Core 4 + MoreActionsSheet
3. `MobileTopBar` + wire into VideoCallScreen
4. Transcript / Participants / SettingsSidebar sheet support
5. Mobile video-grid branch
6. Whiteboard + screen-share mobile layouts
7. Touch-up Create/Join/Landing (dvh, safe-area)
8. CSS pass

## Critical Constraints
- **No regressions** on desktop (≥1024px). All mobile branches must short-circuit on desktop.
- **No feature loss** — every existing capability reachable on mobile.
- **No new dependencies.**
- **Strict TS.** SSR-safe hooks.

## Verification
Test in Chrome DevTools at: iPhone SE (375), iPhone 14 Pro (393), Pixel 7 (412), iPad Mini (768), iPad Pro (1024), Desktop 1440. Verify all states: empty/2/4/8 tiles, transcript drag, participant host controls, settings tabs, screen share, whiteboard, light/dark, no overflow. `npm run lint && npm run build` must pass.
