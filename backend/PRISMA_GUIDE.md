# Prisma ORM — Developer Guide

> Quick reference for the Turnstile Backend team on working with Prisma.

## Getting Started

After cloning the repo, run:

```bash
npm install
npx prisma generate   # generates the Prisma Client (required before running the app)
```

> **Important:** The generated client lives in `src/generated/prisma/` and is **git-ignored**. Every developer must run `prisma generate` locally after install.

## Available Scripts

| Command | What it does |
|---|---|
| `npm run prisma:generate` | Regenerate the Prisma Client after schema changes |
| `npm run prisma:migrate` | Create & apply a new migration (requires DB create permission) |
| `npm run prisma:studio` | Open Prisma Studio — a visual DB browser at `localhost:5555` |

> ⚠️ Our hosted DB doesn't support `prisma migrate dev` (no shadow DB permission). Use `npx prisma db push` to sync schema changes during development.

## Project Structure

```
prisma/
  schema.prisma        # All models & relations defined here
  migrations/          # Auto-generated migration files
prisma.config.ts       # Prisma config (datasource URL, migration path)
src/
  config/prisma.js     # Singleton Prisma Client — import this in your code
  generated/prisma/    # Auto-generated client (git-ignored, don't edit)
```

## Using Prisma in Code

Always import the singleton client:

```js
const prisma = require('../config/prisma');
```

### Common Query Examples

```js
// Find all active workers with their roles
const workers = await prisma.worker.findMany({
  where: { isActive: true },
  include: { role: true },
});

// Find a worker by RFID card
const worker = await prisma.worker.findUnique({
  where: { rfidCardUid: 'ABC123' },
  include: {
    role: {
      include: {
        rolePpeRequirements: {
          include: { ppeItem: true },
        },
      },
    },
  },
});

// Create an entry log with detection details
const log = await prisma.entryLog.create({
  data: {
    rfidUidScanned: 'ABC123',
    workerId: 1,
    result: 'PASS',
    inspectionTimeMs: 320,
    detectionDetails: {
      create: [
        { ppeItemId: 1, wasRequired: true, wasDetected: true, confidence: 0.97 },
        { ppeItemId: 2, wasRequired: true, wasDetected: false, confidence: 0.12 },
      ],
    },
  },
  include: { detectionDetails: true },
});

// Update a worker
await prisma.worker.update({
  where: { id: 1 },
  data: { isActive: false },
});

// Delete with relations (delete detection details first, then entry log)
await prisma.detectionDetail.deleteMany({ where: { entryLogId: 5 } });
await prisma.entryLog.delete({ where: { id: 5 } });
```

## Database Models at a Glance

```
roles  ──<  workers  ──<  entry_logs  ──<  detection_details
  │                                              │
  └──<  role_ppe_requirements  >──  ppe_items  ──┘
```

| Model | JS Name | Key Fields |
|---|---|---|
| `roles` | `prisma.role` | `roleName` (unique) |
| `workers` | `prisma.worker` | `rfidCardUid` (unique), FK → role |
| `ppe_items` | `prisma.ppeItem` | `itemKey` (unique) |
| `role_ppe_requirements` | `prisma.rolePpeRequirement` | Composite PK: (`roleId`, `ppeItemId`) |
| `entry_logs` | `prisma.entryLog` | `result` enum: `PASS` / `FAIL` / `UNKNOWN_CARD` |
| `detection_details` | `prisma.detectionDetail` | `confidence` (Float), FK → entryLog & ppeItem |

## Making Schema Changes

1. Edit `prisma/schema.prisma`
2. Run `npx prisma db push` to sync changes to the database
3. Run `npm run prisma:generate` to regenerate the client
4. Commit the updated `schema.prisma`

## Field Name Mapping

Prisma uses **camelCase** in JavaScript but maps to **snake_case** in the database:

| JS Field | DB Column |
|---|---|
| `fullName` | `full_name` |
| `rfidCardUid` | `rfid_card_uid` |
| `isActive` | `is_active` |
| `createdAt` | `created_at` |

Always use the **camelCase** version in your code.

## Tips

- **Don't instantiate `new PrismaClient()`** in your files — always use `require('../config/prisma')` to avoid connection leaks
- **Use `include`** to load relations, **`select`** to pick specific fields
- **Prisma Studio** (`npm run prisma:studio`) is great for quickly inspecting and editing data during development
- **Check the [Prisma Docs](https://www.prisma.io/docs)** for filtering, pagination, transactions, and more
