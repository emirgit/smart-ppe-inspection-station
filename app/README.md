# PPE Inspection Station — Admin Panel (MOD-05)

Admin Panel web application for the AI-Powered Smart PPE Inspection Station.
Part of the UI & UX module (MOD-05).

**CSE 396 — Computer Engineering Project | Spring 2026 | GROUP-11**

## Author

**Tarık Saeede** — 200104004804

## Tech Stack

- **React 18** with **Vite**
- **Tailwind CSS 3** for styling
- **React Router v6** for routing
- **Recharts** for analytics charts
- **Lucide React** for icons
- **Vitest** + **React Testing Library** for unit tests

## Setup

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:3000)
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Project Structure

```
app/
├── src/
│   ├── components/
│   │   └── Layout.jsx           Sidebar + content outlet
│   ├── pages/
│   │   ├── Dashboard.jsx        Stat cards, recent activity, top missed PPE
│   │   ├── Workers.jsx          Worker list + registration modal
│   │   ├── Roles.jsx            Role cards with PPE requirements
│   │   ├── Logs.jsx             Filterable entry log table
│   │   ├── Analytics.jsx        Charts (Recharts)
│   │   └── pages.test.jsx       Component tests (13 tests)
│   ├── services/
│   │   ├── api.js               Mock API service (will be replaced with fetch calls)
│   │   └── api.test.js          API service tests (28 tests)
│   ├── test/
│   │   └── setup.js             Vitest setup
│   ├── App.jsx                  Router configuration
│   ├── main.jsx                 Entry point
│   └── index.css                Tailwind directives
├── index.html
├── package.json
├── vite.config.js               Vite + Vitest config
├── tailwind.config.js
├── postcss.config.js
└── .gitignore
```

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | System overview with stat cards and recent scans |
| `/workers` | Workers | Register, view, and deactivate workers |
| `/roles` | Roles & PPE | View job roles and their PPE requirements |
| `/logs` | Entry Logs | Searchable history of all inspection events |
| `/analytics` | Analytics | Compliance trends and charts |

## Testing

41 unit tests in total:

- **28 API service tests** (`src/services/api.test.js`) — workers CRUD, roles, PPE items, entry logs filtering/sorting, dashboard stats
- **13 component tests** (`src/pages/pages.test.jsx`) — Dashboard and Workers page rendering and interactions

Run with `npm test`.

## Backend Integration

Currently uses a mock API service in `src/services/api.js`. Will be replaced with HTTP REST calls to MOD-04 (Node.js + Express.js + PostgreSQL) when the backend is ready. The mock service follows the exact response shapes defined in `admin_side_interface.d.ts`.
