# PPE Admin Panel

AI-Powered Smart PPE Inspection Station — Admin Panel

Gebze Technical University | CSE 396 | Group 11

## Tech Stack

- React 19 + TypeScript
- TanStack Router + TanStack Query
- shadcn/ui + Tailwind CSS v4
- Recharts

## Quick Start

```bash
npm install
npm run dev
```

## Environment Variables

```
VITE_API_BASE_URL=http://localhost:5001   # Backend URL
VITE_USE_MOCK=true                        # true = mock data, false = real backend
```

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Stats, recent scans, most missed PPE |
| Workers | `/workers` | Worker CRUD, RFID management |
| Roles & PPE | `/roles` | Role CRUD, PPE item catalog |
| Logs | `/logs` | Entry log list with polling |
| Analytics | `/analytics` | Charts and date range reports |
| Settings | `/settings/appearance` | Theme, display settings |

## Backend Connection

Backend'e bağlanmak için `.env` dosyasında:
```
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://<backend-ip>:5001
```

## Team

| Name | ID | Module |
|------|----|--------|
| Hüseyin Elyesa Yeşilyurt | 210104004080 | Backend (Primary) |
| Ahmet Emre Kurt | 220104004016 | Backend (Primary) |
| Emre İlhan Şenel | 230104004907 | UI & UX (Primary) |
| Tarık Saeede | 200104004804 | UI & UX (Primary) |
