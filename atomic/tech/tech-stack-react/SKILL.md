---
name: tech-stack-react
description: React 19 + TypeScript + Vite front-end stack: React Router, Zustand, TanStack Query, React Hook Form + Zod, Axios, Tailwind, Vitest, React Testing Library and Playwright, with project-structure conventions, plus a step-by-step new-project scaffolding workflow with done criteria. Use when scaffolding a new project on this stack or creating or structuring a React application.
---

# React Front-End Stack

## Technology Stack

> **Version pins — last verified: (not recorded; write the YYYY-MM here when you check them).** This table is the only place these versions are pinned; composites refer to it. Before starting a new project, check the official release notes and update this table (and its date) rather than copying newer versions into other skills.

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| Language | TypeScript | 5.5.x | Strict mode enabled; no `any` |
| Framework | React | 19.2.x | Functional components only; hooks-based; supports Server Components and new `use()` API |
| Build | Vite | 6.3.x | Fast dev server and optimised production builds |
| Routing | React Router | 7.1.x | Supports React 19 form/action APIs; framework and library modes |
| State Management | Zustand 5 + TanStack Query 5 | 5.0.x / 5.60.x | Zustand for UI state; TanStack Query for server state — never store server data in Zustand |
| Forms | React Hook Form + Zod | 7.52.x / 4.0.x | Schema-driven validation via Zod v4; no uncontrolled inputs |
| HTTP Client | Axios or Fetch API (wrapped) | 1.7.x | Centralised API client with interceptors |
| UI Components | (TBD — e.g. shadcn/ui, MUI, Ant Design) | — | Pick one; avoid mixing component libraries |
| Charts | Recharts or Chart.js (via react-chartjs-2) | 2.12.x / 4.4.x + 5.2.x | For bar, pie, multi-line, and other chart types |
| Testing | Vitest + React Testing Library + Playwright | 3.1.x / 16.2.x / 1.54.x | Unit, component, and E2E tests |
| Styling | Tailwind CSS v4 or CSS Modules | 4.1.x | Tailwind v4: CSS-first config via `@theme`; no `tailwind.config.js` needed |
| Linting | ESLint + Prettier | 9.x / 3.4.x | ESLint 9 flat config (`eslint.config.js`); enforced via pre-commit hook |

---

## Project Structure

Domain types and the API client are shared once; pages, components, hooks, and services split by module.

```
src/
├── domain/                         ← SHARED — TypeScript types mirroring back-end domain model
│   └── types/                      ← Pure types; no React or API dependencies
│
├── api/                            ← SHARED — centralised HTTP client + typed API functions
│   ├── client.ts                   ← Axios/Fetch base client with auth interceptor
│   └── endpoints/                  ← One file per back-end resource
│                                     Functions return domain types; Zod schemas validate responses
│
├── modules/                        ← Split by business module
│   └── <module>/
│       ├── pages/                  ← Route-level components
│       ├── components/             ← Module-specific UI components
│       ├── hooks/                  ← TanStack Query + Zustand hooks
│       └── store.ts                ← Zustand slice for module UI state
│
├── shared/
│   ├── components/                 ← Reusable UI primitives (Button, Modal, Table, Spinner, …)
│   ├── hooks/                      ← Generic hooks (useDebounce, usePagination, …)
│   └── utils/                      ← Pure utility functions
│
├── router/                         ← Route definitions; imports pages from modules/
└── main.tsx
```

### Split rationale

| Artefact | Split by module? | Reason |
|----------|-----------------|--------|
| `domain/types/` | No | All modules operate on the same entities — one source of truth |
| `api/` | No | Base client and auth interceptor are shared; endpoint files are per-resource |
| `modules/*/pages/` | Yes | Each module owns its own routes and page-level components |
| `modules/*/components/` | Yes | Module-specific UI components not reused elsewhere |
| `modules/*/hooks/` | Yes | TanStack Query hooks for module-specific use cases |
| `modules/*/store.ts` | Yes | UI state (modals, selections) is module-scoped |
| `shared/components/` | No | Generic UI primitives reused across all modules |

---

## Conventions & Patterns

### General
- **Functional components only** — no class components.
- **TypeScript strict mode** — no `any`; define explicit types for all props, API responses, and state.
- **Named exports** for components; default export only for pages/routes.
- Keep components small and focused; extract logic into custom hooks.
- Co-locate component styles, tests, and hooks with the component when possible.

### Naming
- Domain types: `PascalCase` matching back-end model — in `domain/types/`
- API functions: camelCase verb + noun (e.g. `getItems`, `createItem`) — in `api/endpoints/`
- Components: `PascalCase` (e.g. `ItemForm`, `ItemCard`)
- Hooks: `use` prefix + camelCase (e.g. `useItems`, `useCreateItem`)
- Types/Interfaces for DTOs/props: `PascalCase`; use `interface` for object shapes, `type` for unions/aliases
- Files: `PascalCase` for components, `camelCase` for hooks/utils/api files

### State Management
- **Server state** (API data, loading, errors) → **TanStack Query** (`useQuery`, `useMutation`).
- **UI state** (modals, selected tabs, filters) → **Zustand** store per module.
- Never store server data in Zustand; let TanStack Query cache manage it.
- Derive computed values from existing state; avoid duplicating state.

### API Layer
- Base client and auth interceptor live in `api/client.ts` — shared, never duplicated per module.
- Typed API functions live in `api/endpoints/` grouped by back-end resource, not by front-end module.
- Use Zod schemas to validate and parse API responses at the boundary; parsed results are typed as `domain/types/`.
- Handle errors consistently: map HTTP errors to user-facing messages in a shared error handler.
- Module hooks (`modules/*/hooks/`) call `api/endpoints/` functions via TanStack Query — they never call `fetch`/`axios` directly.

### Forms
- Use **React Hook Form** with **Zod** schema resolvers for all forms.
- Validate on submit and on blur for better UX.
- Never manage form state with `useState`; let React Hook Form control it.

### Component Design
- **Presentational vs Container**: separate data-fetching (hooks/containers) from rendering (pure components).
- **Props drilling limit**: if props go more than 2 levels deep, use context or Zustand.
- **Error boundaries**: wrap each module's page tree in an `ErrorBoundary` component.
- **Loading states**: every async operation must have a skeleton or spinner fallback.

---

## Configuration Files

### Environment variables — `.env` files

Vite exposes variables prefixed with `VITE_` to the client bundle. Never put secrets here.

```
.env                  ← base defaults (committed)
.env.development      ← local dev overrides (committed)
.env.staging          ← staging environment (committed)
.env.production       ← production environment (committed)
.env.local            ← machine-local overrides, never committed (add to .gitignore)
```

**.env.development**
```dotenv
VITE_API_BASE_URL=http://localhost:8080/api
VITE_APP_ENV=development
VITE_ENABLE_MOCKS=true
```

**.env.production**
```dotenv
VITE_API_BASE_URL=https://api.myapp.com/api
VITE_APP_ENV=production
VITE_ENABLE_MOCKS=false
```

Access in code via `import.meta.env.VITE_API_BASE_URL`.  
Type-safe env: declare in `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_APP_ENV: 'development' | 'staging' | 'production';
  readonly VITE_ENABLE_MOCKS: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

---

### Vite — `vite.config.ts`

```ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});
```

---

### TypeScript — `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "skipLibCheck": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

---

### ESLint — `eslint.config.js` (flat config)

```js
import js from '@eslint/js';
import ts from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default ts.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...ts.configs.strictTypeChecked],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { project: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  }
);
```

---

### Prettier — `prettier.config.js`

```js
export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  plugins: ['prettier-plugin-tailwindcss'],
};
```

---

### Vitest — `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['src/test/**', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

**`src/test/setup.ts`**
```ts
import '@testing-library/jest-dom';
```

---

### Playwright — `playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

### Tailwind CSS v4 — `src/index.css`

With Tailwind v4 the configuration lives in CSS, not in a JS file:

```css
@import "tailwindcss";

@theme {
  --color-primary: #2563eb;
  --color-secondary: #7c3aed;
  --font-sans: 'Inter', sans-serif;
  --radius-card: 0.75rem;
}
```

---

## Testing Strategy
- **Unit tests (Vitest)**: pure utility functions and custom hooks (via `renderHook`).
- **Component tests (React Testing Library)**: render components with mocked queries/stores; assert on visible output.
- **E2E tests (Playwright)**: cover critical user flows end to end.

---

## New project workflow

**Ground rules**
- Ask for the inputs below that the user hasn't given, and show the defaults you'll use. Then proceed without further questions.
- Create the project in a **new or empty** folder, and never overwrite existing files. If the folder isn't empty, stop and ask.
- Take every version from this skill's Technology Stack table (and its reference files). Don't pull "latest" from memory or from a generator, and if a generator writes different versions, change them to the table's.
- Scaffold the skeleton only: build files, layout, configuration, a health check, and one smoke test. Add no example domain code, sample entities or database migrations unless asked.
- If a required tool is missing (JDK, Maven, Gradle, .NET SDK, Node, Android SDK), say so. Generate the files anyway, and report the verification steps you couldn't run as **not verified**. Never claim a build passed without running it.

**Inputs:** app name (e.g. `backoffice-ui`) · UI component library (the table leaves it TBD; ask, or default to none) · styling: **Tailwind v4** (default) or CSS Modules.

1. **Scaffold.** Run `npm create vite@latest <name> -- --template react-ts`, then remove the demo assets and `App` content.
2. **Dependencies.** Install the libraries from the Technology Stack table, pinned to the listed major and minor lines (React Router, Zustand, TanStack Query, React Hook Form, Zod, Axios, the chart library only if needed, Tailwind). Dev tooling: Vitest, React Testing Library, Playwright, ESLint 9 flat config, Prettier.
3. **Configuration.** Write the files exactly as in the Configuration Files section: `.env` files, `vite.config.ts`, `tsconfig.json` (strict), `eslint.config.js`, `prettier.config.js`, `vitest.config.ts`, `playwright.config.ts` and `src/index.css`.
4. **Layout.** Create the Project Structure folders, the API client (`src/api/client.ts` with the base URL from `VITE_API_BASE_URL`), the TanStack Query provider, the router with a placeholder home route, and an error boundary.
5. **Scripts.** `package.json` needs at least `dev`, `build`, `preview`, `lint`, `typecheck` (`tsc --noEmit`), `test` and `test:e2e`.
6. **Tests.** One Vitest + React Testing Library test rendering the home route, and one Playwright test that the app loads.
7. **Repo files.** `.gitignore` (node_modules, dist, `.env.local`), `.env.example`, and a `README.md`.
8. **Verify.** Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`. Run `npx playwright install` + `npm run test:e2e` only if the browsers can be installed; otherwise report that step as not verified.

## Done criteria (new project)

- [ ] Lint, type-check, unit tests and build are all green. E2E is green or explicitly reported as not verified.
- [ ] The installed versions (`npm ls --depth=0`) match this skill's table.
- [ ] Strict TypeScript with no `any`, and ESLint and Prettier are configured.
- [ ] No demo code is left. The API base URL comes from env, and `.env.example` documents it.
