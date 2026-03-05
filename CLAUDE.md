# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Clover

Personal productivity web app: kanban boards, timers, pomodoro, notes.

## Commands

All commands run from the `frontend/` directory:

```bash
npm run dev       # start dev server
npm run build     # tsc -b && vite build
npm run lint      # eslint
npm run preview   # preview production build
```

No test runner is configured.

## Architecture

- **Frontend**: React 19 + Vite (SWC) + TypeScript (strict mode) + Tailwind CSS v4
- **Backend**: Supabase — PostgreSQL + PostgREST + Edge Functions; frontend connects directly via `supabase-js`, no custom API layer
- **Auth**: Supabase Auth with Google SSO; Row Level Security enforces per-user data isolation
- **Hosting**: Vercel (planned)
- Real-time sync via PostgreSQL change subscriptions

Tailwind is configured via the `@tailwindcss/vite` plugin (v4 style — no `tailwind.config.js`). Global base styles live in `frontend/src/index.css`.

### Frontend Structure

```
src/
  pages/       # Full-page route components (HomePage, KanbanPage)
  components/  # Reusable UI components
  contexts/    # React Context providers (auth, data)
  constants/   # Shared constants (routes.ts uses `as const` enum pattern)
```

### Routing

- React Router v7, installed as `react-router`
- Routes defined in `frontend/src/constants/routes.ts` using the `as const` pattern
- `App.tsx` wires `BrowserRouter` → `AppRoutes` → `Routes`/`Route` components

## TypeScript Standards

- Use `type` not `interface`
- Use `function` declarations not arrow functions
- For enums: use `const Abc = { ... } as const` and export `type AbcType = typeof Abc[keyof typeof Abc]`
- Omit semicolons; no trailing commas
- Always provide explicit parameter and return types; add additional types only when needed to satisfy the type checker

## Coding Standards

- Use guard statements to avoid deep nesting
- Extract repeated logic into variables or functions; use intermediate variables to break up complex expressions
- Only add comments for complex logic or important context
- Use Windows line endings (CRLF)

## Frontend Design Standards

- Production-grade, distinctive aesthetic — avoid generic AI/template looks
- Bold typography — avoid Arial, Inter, Roboto, and system font stacks; choose unexpected, characterful fonts
- Cohesive color palettes: dominant color + sharp accent; use CSS variables for consistency
- CSS-only animations preferred; focus on high-impact moments (page load staggered reveals, meaningful hover states)
- Unexpected layouts — favor asymmetry, overlap, and diagonal flow over centered grids
- Backgrounds: prefer atmosphere and depth (gradient meshes, noise textures, layered transparencies) over solid colors

## Agent Skills

Domain-specific rules are in `.agent/skills/`. Apply only the skill files relevant to the current task:
- `.agent/skills/typescript.md` — TypeScript syntax and formatting rules
- `.agent/skills/frontend-design.md` — Design thinking and aesthetic guidelines
- `.agent/skills/python.md` — Python conventions
