# clover

A small todo app: lists, tasks, steps, due dates, priority, stage, and drag and drop.

## Tech stack

- React 19 + TypeScript
- Vite
- Tailwind CSS 4
- dnd-kit (drag and drop)
- Vitest + Testing Library (tests)
- Playwright (browser tests)
- oxlint (lint)

## Structure

```
frontend/                  web app
  src/
    main.tsx, App.tsx      entry point and root component
    types.ts, seed.ts      types and seed data
    styles.ts, index.css   styles
    smartLists, stages,    logic modules
    drop, dates, labels,
    selection
    components/            UI (ListSidebar, TaskPane, TaskDetailPane, ...)
  tests/unit/              unit tests (vitest, jsdom)
  tests/e2e/               browser tests (Playwright)
  public/                  static assets
backend/                   Python Lambda API (see ARCHITECTURE.md)
infra/                     Terraform (AWS backend, see ARCHITECTURE.md)
```

## Prerequisites

Node.js and npm.

## Installation

```sh
cd frontend
npm install
```

## Run

From `frontend/`:

```sh
npm run dev    # start dev server
npm test       # run tests
npm run e2e    # run browser tests
npm run build  # type-check and build
npm run lint   # lint
```
