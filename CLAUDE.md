# CLAUDE.md - My Agora App

## Project Overview
A private user-to-agent calling application. Google-authenticated users launch directly into a random Agora RTC/RTM channel with a Conversational AI agent.

## Tech Stack
- **Framework:** Next.js 15 + React 19 + TypeScript 5.8
- **Agora SDKs:** agora-rtc-sdk-ng (media), agora-rtm-sdk (transcript/chat), agora-token (server token generation)
- **State:** Zustand 5
- **Routing/Auth:** Next.js App Router + NextAuth
- **Styling:** TailwindCSS 4 with dark mode (class strategy)
- **Notifications:** react-toastify

## Folder Structure
```
app/               # Pages, protected API routes, auth callbacks
src/
├── api/           # Backend API calls
├── components/
│   ├── common/    # Reusable UI (Button, Card, Modal, InputField)
│   └── *.tsx      # Domain-specific components
├── hooks/         # Custom hooks (useAgora for SDK logic)
├── screens/       # Page-level components
├── services/      # Utility services (uiService for toasts)
├── store/         # Zustand store (useAppStore)
├── types/         # TypeScript definitions
```

## Naming Conventions
- **Components:** PascalCase (`VideoTile.tsx`, `CreateMeetingScreen.tsx`)
- **Utilities/hooks:** camelCase (`agoraApi.ts`, `useAgora.ts`)
- **Hooks:** `use` prefix (`useAgora`, `useAppStore`)
- **Handlers:** `handle*` prefix (`handleJoinMeeting`, `handleUserPublished`)
- **Booleans:** `is`/`has`/`can` prefix (`isAgentActive`, `hasAudio`)
- **Constants:** SCREAMING_SNAKE_CASE (`AGORA_CONFIG`)

## Component Patterns
```typescript
// Use React.FC with explicit props interface
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
}

const Button: React.FC<ButtonProps> = ({ children, onClick, variant = "primary" }) => {
  return <button onClick={onClick}>{children}</button>;
};

export default Button;
```

## State Management
- Use Zustand store for global state (`useAppStore`)
- Use primitive selectors to prevent unnecessary re-renders:
```typescript
// Good
const audioMuted = useAppStore((state) => state.audioMuted);

// Avoid
const { audioMuted, videoMuted } = useAppStore();
```

## Styling Rules
- Use Tailwind utility classes directly
- Dark mode: use `dark:` prefix (`dark:bg-gray-800`)
- Responsive: mobile-first with `sm:`, `md:` breakpoints
- Theme colors defined as CSS variables in `index.css`

## Code Rules
1. **TypeScript strict mode** - no `any`, explicit types for props/returns
2. **Functional components only** - no class components
3. **useCallback** for handlers passed as props
4. **async/await** with try/catch for async operations
5. **showToast()** from uiService for user feedback
6. **Environment variables** use `VITE_` prefix, access via `import.meta.env`

## File Organization (within a file)
1. Imports (libraries first, then relative)
2. Type definitions/interfaces
3. Component declaration
4. Event handlers (useCallback)
5. Effects (useEffect)
6. Return JSX
7. Export

## Common Commands
```bash
npm run dev      # Start Next.js dev server
npm test         # Run Vitest suite
npm run build    # TypeScript check + Next.js build
npm run lint     # ESLint
npm run preview  # Preview production build
```

---

## Claude Code Customizations

> **Auto-Documentation Rule:** After adding/modifying any Claude Code customization (plugins, skills, MCP servers, slash commands, sub-agents, hooks), always update `docs/claude-code-journey.md` with the change details, installation steps, and observations.

### Installed Plugins

| Plugin | Source | Installed | Purpose |
|--------|--------|-----------|---------|
| frontend-design | claude-plugins-official | Jan 28, 2026 | Auto-activates for UI work, improves design quality |
| feature-dev | claude-plugins-official | Jan 28, 2026 | Structured feature development workflow with /feature-dev command |

### MCP Servers
_None configured yet_

### Custom Slash Commands
_None configured yet_

### Sub-Agents
_None configured yet_

### Hooks
_None configured yet_

### Skills
_Using plugin-provided skills only_
```

---

## What Happens Now

1. **Claude Code reads CLAUDE.md** every session
2. **Sees the Auto-Documentation Rule** 
3. **Reminds you to update journal** when you add plugins/MCP/hooks
4. **Customizations table** gives quick overview of your setup

---

## Quick Test After Installation

Ask Claude Code:
```
Build a simple modal component with a nice design
