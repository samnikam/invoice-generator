# SmartBill

**Universal Invoice Generator & Business Calculators** for Indian small businesses, freelancers,
shop owners and service providers.

> **Status:** Phase 1, Step 1.0 — project setup only. Invoicing features are not built yet.
>
> SmartBill is not government-certified software. Users are responsible for ensuring their
> documents meet GST and other legal requirements.

---

## Tech stack

| Purpose            | Tool                                                         |
| ------------------ | ------------------------------------------------------------ |
| Framework          | Next.js 16 (App Router) + React 19 + TypeScript (strict)     |
| Styling / UI       | Tailwind CSS 4 + shadcn/ui (Radix primitives) + Lucide icons |
| Unit tests         | Vitest                                                       |
| End-to-end tests   | Playwright (Chromium, desktop + mobile viewports)            |
| Code quality       | ESLint, Prettier, `tsc --noEmit`                             |
| Package manager    | pnpm (only — do not use npm or yarn in this project)         |
| Database (Phase 2) | PostgreSQL + Prisma — **not used yet**                       |

> **Version notes:** TypeScript is pinned to 6.0.x and ESLint to 9.x on purpose. TypeScript 7
> and ESLint 10 exist, but the Next.js lint plugins do not support them yet.

---

## Setup on Windows (PowerShell)

### 1. Prerequisites

Check that these are installed (open PowerShell and run each line):

```powershell
node -v    # must be v22.12.0 or newer
pnpm -v    # must be v10 or newer
git --version
```

- Node.js: https://nodejs.org (choose the LTS version)
- pnpm: after installing Node.js, run `corepack enable pnpm`

### 2. Install dependencies

```powershell
cd C:\dev\invoice
pnpm install
```

### 3. Environment variables

```powershell
Copy-Item .env.example .env.local
```

`.env.local` is ignored by Git. Put any real values there, never in `.env.example`.
Phase 1 does not need any secrets.

### 4. Run the app

```powershell
pnpm dev
```

Open http://localhost:3000 in your browser. Press `Ctrl + C` in PowerShell to stop it.

---

## Commands

| Command             | What it does                                                          |
| ------------------- | --------------------------------------------------------------------- |
| `pnpm dev`          | Start the development server with live reload                         |
| `pnpm build`        | Create an optimised production build                                  |
| `pnpm start`        | Run the production build (run `pnpm build` first)                     |
| `pnpm lint`         | Check code for problems with ESLint                                   |
| `pnpm typecheck`    | Check TypeScript types without building                               |
| `pnpm format`       | Auto-format all files with Prettier                                   |
| `pnpm format:check` | Check formatting without changing files                               |
| `pnpm test`         | Run unit tests once (Vitest)                                          |
| `pnpm test:watch`   | Re-run unit tests whenever a file changes                             |
| `pnpm test:e2e`     | Build the app and run browser tests (Playwright)                      |
| `pnpm check`        | Run format check, lint, typecheck, unit tests and build — all at once |

### First-time Playwright setup

Playwright needs its own copy of the Chromium browser (about 150 MB, downloaded once):

```powershell
pnpm exec playwright install chromium
```

---

## Project structure

```
src/
  app/          Pages and layouts (Next.js App Router)
  components/
    ui/         Reusable shadcn/ui components
  config/       Product name and app-wide settings (site.ts)
  lib/          Pure, tested business logic (money, tax) — no React here
tests/
  e2e/          Playwright end-to-end tests
```

Unit tests sit next to the file they test, e.g. `src/config/site.test.ts`.

---

## Security notes

- Never commit `.env`, `.env.local` or any file containing passwords or API keys.
- `.env.example` must contain placeholder values only.
- Phase 1 drafts are saved in the browser (`localStorage`) on the user's own device only.
  Passwords, secrets and payment credentials are never stored there.
