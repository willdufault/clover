# clover

A personal productivity app — kanban boards, timers, pomodoro sessions, notes, and more.

> This project is still a WIP. Some features have not yet been added.

## Features

- **Kanban** — drag-and-drop boards with columns and cards
- **Timers** — countdown, stopwatch, and pomodoro sessions linked to tasks
- **Notes** — markdown notes, optionally linked to cards
- More coming

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Hosting | Vercel |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Google SSO) |
| Backend | Supabase PostgREST + Edge Functions |

## Architecture

The frontend communicates directly with Supabase for all data operations. Row Level Security (RLS) policies on each table enforce that users can only access their own data. Supabase Auth handles SSO — Google OAuth today, more providers in the future. Supabase Edge Functions cover any server-side logic that goes beyond direct database queries.

> Currently this project is frontend and in-memory only. Persistent backend is coming soon.

### Project Structure

```
clover/
├── frontend/       # React + Vite + Tailwind
├── backend/        # Supabase config, migrations, Edge Functions
└── docs/           # Architecture decisions
```

### How it fits together

- **Auth**: Google SSO via Supabase Auth → JWT attached to every request → RLS enforces per-user data isolation at the database level
- **Data**: Frontend queries Supabase directly via `@supabase/supabase-js` — no custom API layer needed for CRUD
- **Realtime**: Postgres change subscriptions keep the UI in sync across tabs without polling
- **Server-side logic**: Edge Functions handle anything beyond direct database queries (emails, integrations, etc.)

## Development

> Setup instructions coming as the project is built out.
