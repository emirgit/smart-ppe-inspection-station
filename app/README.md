# PPE Inspection Station — Admin Panel v2.0 (MOD-05)

Admin Panel web application for the AI-Powered Smart PPE Inspection Station.

**CSE 396 — Computer Engineering Project | Spring 2026 | GROUP-11**

## What's New in v2.0

This is a complete rebuild based on the team's requirements (April 2026):

- **shadcn/ui** components (built on Radix UI primitives) replacing the previous custom components
- **Dark mode** support with system preference detection
- **Real backend connection** with mock fallback — toggle via Settings panel
- **Settings panel** (slide-out Sheet) for theme, API URL, and mock mode
- **Full CRUD** on Workers, Roles, and PPE Items
- **Edit dialog** for workers (was missing in v1)
- **Plain RFID text input** (was a random-generator button in v1)
- **AlertDialog confirmations** for destructive actions (was `window.confirm`)
- **Real-time logs** with 10-second polling
- **Date range picker** on Analytics (7d / 30d / 90d / all)
- **Toast notifications** for all actions
- **Empty states** and **error states with Retry** buttons

## Author

**Tarık Saeede** — 200104004804

## Tech Stack

- **React 18** + **Vite** — UI framework and build tool
- **Tailwind CSS** with shadcn/ui design tokens
- **Radix UI** primitives (Dialog, AlertDialog, Sheet, Select, Switch, Toast, etc.)
- **React Router v6** — client-side routing
- **Recharts** — analytics charts
- **Lucide React** — icons
- **Vitest** + **React Testing Library** — unit tests

## Setup

```bash
# Install dependencies
npm install

# Configure backend URL (optional)
cp .env.example .env
# Edit .env to set VITE_API_BASE_URL and VITE_USE_MOCK

# Start dev server (http://localhost:3000)
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Switching Between Mock and Real Backend

Two ways to control which API the app uses:

**Option 1: .env file (compile-time default)**

```bash
VITE_API_BASE_URL=http://192.168.1.100:8000
VITE_USE_MOCK=false
```

**Option 2: Settings panel (runtime, persists to localStorage)**

Click the **Settings** button in the sidebar footer:
- Toggle "Use Mock Data" on/off
- Enter the backend API URL
- Click "Save Changes"

The Settings panel takes precedence over .env when both are set.

## Project Structure

```
app/
├── src/
│   ├── components/
│   │   ├── ui/              shadcn primitives (Button, Card, Dialog, etc.)
│   │   ├── layout.jsx       Sidebar + content outlet
│   │   ├── settings-sheet.jsx
│   │   ├── stat-card.jsx    Shared dashboard stat card
│   │   ├── result-badge.jsx Shared PASS/FAIL/UNKNOWN badge
│   │   ├── status-badge.jsx Shared Active/Inactive badge
│   │   ├── empty-state.jsx  Shared empty state with optional action
│   │   └── error-state.jsx  Shared error with Retry button
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Workers.jsx      Full CRUD with edit dialog
│   │   ├── Roles.jsx        Roles + PPE catalog CRUD
│   │   ├── Logs.jsx         Real-time polling
│   │   ├── Analytics.jsx    Date range picker
│   │   └── pages.test.jsx
│   ├── services/
│   │   ├── api.js           Real fetch + mock proxy
│   │   ├── api.test.js
│   │   └── mock-data.js
│   ├── hooks/
│   │   └── use-toast.js
│   ├── context/
│   │   └── theme-provider.jsx
│   ├── lib/
│   │   ├── utils.js         cn() helper
│   │   └── settings.js      localStorage persistence
│   ├── test/
│   │   └── setup.js
│   ├── App.jsx              Router
│   ├── main.jsx             Entry point
│   └── index.css            Theme tokens (light + dark)
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js           Vite + Vitest config
└── jsconfig.json            @ alias for IDE
```

## Pages

| Route | Page | What's New |
|-------|------|-----------|
| `/` | Dashboard | shadcn Card layout, dark mode, fetches in parallel |
| `/workers` | Workers | Edit dialog, plain RFID input, AlertDialog for deactivate |
| `/roles` | Roles & PPE | Full CRUD, delete protection, PPE catalog management |
| `/logs` | Entry Logs | 10s polling, refresh button, last-updated timestamp |
| `/analytics` | Analytics | Date range picker, theme-aware chart colors |

## API Integration

The `api` object in `src/services/api.js` is a Proxy that dispatches to either:
- **Mock implementation** — when Settings has `useMock: true`
- **Real fetch implementation** — calls `${apiBaseUrl}/api/...` endpoints

All method names match the `BackendApiContract` interface from `admin_side_interface.d.ts`:

- `listWorkers(query?)`, `createWorker`, `getWorkerById`, `updateWorker`, `softDeleteWorker`, `lookupWorkerByCard`
- `listRoles`, `createRole`, `updateRole`, `deleteRole`, `getRolePpe`, `replaceRolePpe`
- `listPpeItems`, `createPpeItem`, `deletePpeItem`
- `listEntryLogs(query?)`, `getEntryLogStats(query?)`

Standard response format:
```js
// Success
{ success: true, data: ... }
// Paginated
{ success: true, data: [...], total, limit, offset }
// Error
{ success: false, error: { code: 404, message: "..." } }
```

Errors throw `ApiError` with `code` and `message` properties.

## Testing

```bash
npm test
```

Runs all unit tests against the mock API. Same tests would also work against the real backend.

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-18 | Initial alpha release |
| 2.0 | 2026-04-29 | shadcn/ui migration, real backend connection, full CRUD, settings panel |
