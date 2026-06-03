# PPE Inspection Station — API Contract

> **Version:** v1.1 · **Project:** CSE 396 — Group 11 · Module 4 & 5 Reference

---

## Overview

| Property | Value |
|---|---|
| Base URL | `http://<server-ip>:8000` |
| Protocol | HTTP/1.1 · REST |
| Content-Type | `application/json` (all endpoints) |
| Authentication | None (local network) |

---

## System Architecture

```
Admin Panel  ⇄  Backend Server  ⇄  Raspberry Pi  ⇄  Tablet / Display
(Web/Desktop)   (REST API + DB)    (RFID + AI + Gate)  (Direct from RPi)
 Module 5         Module 4          Modules 1, 2, 3       No server conn.
```

> **Important:** The Tablet/Display does **not** connect to the backend — it receives all screen updates directly from the RPi. This API contract covers only **Admin Panel ↔ Backend** and **RPi ↔ Backend** communication.

---

## RPi Inspection Flow

| Step | Actor | Description | Backend Call |
|---|---|---|---|
| 1 | RPi (local) | RC522 reads RFID card UID | ❌ None |
| 2 | RPi → Backend | Validate card, retrieve worker info + required PPE list | `GET /api/workers/card/:uid` |
| 3 | RPi (local) | Open camera, run AI model, detect PPE items | ❌ None |
| 4 | RPi (local) | Compare `required_ppe` vs `detected` → PASS / FAIL decision | ❌ None |
| 5 | RPi (local) | Open/lock turnstile, update tablet display | ❌ None |
| 6 | RPi → Backend | Save inspection result with all details | `POST /api/entry-logs` |

---

## Standard Error Response

All endpoints use the same error envelope:

```json
{
  "success": false,
  "error": {
    "code": 404,
    "message": "Worker not found"
  }
}
```

---

## Endpoints

### Workers

---

#### `GET /api/workers`

List all workers.

**Caller:** Admin Panel

**Query Parameters** *(all optional)*

| Parameter | Type | Description |
|---|---|---|
| `is_active` | boolean | Filter by active status |
| `role_id` | integer | Filter by role |

**Example Request**
```
GET /api/workers?is_active=true&role_id=2
```

**200 OK**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "full_name": "Ali Yılmaz",
      "rfid_card_uid": "A3F2C1D4",
      "role_id": 2,
      "role_name": "Technician",
      "is_active": true,
      "photo_url": "/uploads/workers/1.jpg",
      "created_at": "2026-03-01T10:00:00Z"
    }
  ],
  "total": 42
}
```

**Status Codes:** `200 OK`

---

#### `POST /api/workers`

Create a new worker.

**Caller:** Admin Panel

**Request Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `full_name` | string | ✅ | |
| `rfid_card_uid` | string | ✅ | Must be unique |
| `role_id` | integer | ✅ | Must reference an existing role |
| `photo_url` | string | ❌ | Nullable |

```json
{
  "full_name": "Mehmet Kara",
  "rfid_card_uid": "B4E1A2C3",
  "role_id": 2,
  "photo_url": "/uploads/workers/2.jpg"
}
```

**201 Created**
```json
{
  "success": true,
  "data": {
    "id": 7,
    "full_name": "Mehmet Kara",
    "rfid_card_uid": "B4E1A2C3",
    "role_id": 2,
    "role_name": "Technician",
    "is_active": true,
    "photo_url": "/uploads/workers/2.jpg",
    "created_at": "2026-03-20T09:15:00Z"
  }
}
```

**Error Responses**

| Status | Message |
|---|---|
| `409` | `"RFID card already registered"` |
| `422` | `"full_name is required"` |
| `404` | `"Role not found"` |

**Status Codes:** `201 Created` · `404` · `409` · `422`

---

#### `GET /api/workers/:id`

Get a single worker by ID.

**Caller:** Admin Panel

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | integer | Worker ID |

**200 OK**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "full_name": "Ali Yılmaz",
    "rfid_card_uid": "A3F2C1D4",
    "role_id": 2,
    "role_name": "Technician",
    "is_active": true,
    "photo_url": "/uploads/workers/1.jpg",
    "created_at": "2026-03-01T10:00:00Z",
    "updated_at": "2026-03-15T14:22:00Z"
  }
}
```

**404 Not Found**
```json
{ "success": false, "error": { "code": 404, "message": "Worker not found" } }
```

**Status Codes:** `200 OK` · `404`

---

#### `PUT /api/workers/:id`

Partially update a worker's information. Only the fields sent will be updated.

**Caller:** Admin Panel

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | integer | Worker ID |

**Request Body** *(all fields optional)*

| Field | Type | Notes |
|---|---|---|
| `full_name` | string | |
| `role_id` | integer | |
| `photo_url` | string | |
| `rfid_card_uid` | string | Unique constraint applies |

```json
{
  "full_name": "Ali Kara",
  "role_id": 3,
  "photo_url": "/uploads/1.jpg",
  "rfid_card_uid": "NEWUID123"
}
```

**200 OK** — Returns the updated worker object (same shape as `GET /workers/:id`).

**Status Codes:** `200 OK` · `404` · `409`

---

#### `DELETE /api/workers/:id`

Soft-delete a worker — sets `is_active = false`. The worker record and all entry log history are preserved.

**Caller:** Admin Panel

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | integer | Worker ID |

**200 OK**
```json
{ "success": true, "message": "Worker deactivated", "data": { "id": 1, "is_active": false } }
```

**Status Codes:** `200 OK` · `404`

---

#### `GET /api/workers/card/:uid`

⚡ **Critical RPi endpoint — Step 2 of the inspection flow.**

Validate an RFID card and return the worker's info along with the required PPE list for their role. The RPi uses the returned `required_ppe` list to compare against AI detection results and make the PASS/FAIL decision locally.

**Caller:** Raspberry Pi (Step 2)

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `uid` | string | RFID card UID read by RC522 |

**200 OK — Registered Card**
```json
{
  "success": true,
  "data": {
    "worker": {
      "id": 1,
      "full_name": "Ali Yılmaz",
      "photo_url": "/uploads/workers/1.jpg",
      "role_name": "Technician"
    },
    "required_ppe": [
      { "id": 1, "item_key": "hard_hat",    "display_name": "Hard Hat",    "icon_name": "helmet" },
      { "id": 2, "item_key": "safety_vest", "display_name": "Safety Vest", "icon_name": "vest"   },
      { "id": 3, "item_key": "gloves",      "display_name": "Gloves",      "icon_name": "glove"  }
    ]
  }
}
```

**404 — Unregistered Card** → RPi will log `UNKNOWN_CARD` and deny entry.
```json
{ "success": false, "error": { "code": 404, "message": "Card not registered" } }
```

**Status Codes:** `200 OK` · `404`

---

### Roles

---

#### `GET /api/roles`

List all roles.

**Caller:** Admin Panel

**200 OK**
```json
{
  "success": true,
  "data": [
    { "id": 1, "role_name": "Visitor",             "description": "Site visitors",          "created_at": "2026-01-01T00:00:00Z" },
    { "id": 2, "role_name": "Technician",          "description": "Technical staff",        "created_at": "2026-01-01T00:00:00Z" },
    { "id": 3, "role_name": "Construction Worker", "description": "Heavy-duty zone workers", "created_at": "2026-01-01T00:00:00Z" }
  ]
}
```

**Status Codes:** `200 OK`

---

#### `POST /api/roles`

Create a new role.

**Caller:** Admin Panel

**Request Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `role_name` | string | ✅ | Must be unique |
| `description` | string | ❌ | |

```json
{
  "role_name": "Construction Worker",
  "description": "Heavy-duty zone workers"
}
```

**201 Created**
```json
{
  "success": true,
  "data": {
    "id": 3,
    "role_name": "Construction Worker",
    "description": "Heavy-duty zone workers",
    "created_at": "2026-03-20T10:00:00Z"
  }
}
```

**Status Codes:** `201 Created` · `409` · `422`

---

#### `GET /api/roles/:id/ppe`

Get the required PPE items for a given role.

**Caller:** Admin Panel

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | integer | Role ID |

**200 OK**
```json
{
  "success": true,
  "data": {
    "role_id": 2,
    "role_name": "Technician",
    "ppe_items": [
      { "id": 1, "item_key": "hard_hat",    "display_name": "Hard Hat"    },
      { "id": 2, "item_key": "safety_vest", "display_name": "Safety Vest" },
      { "id": 3, "item_key": "gloves",      "display_name": "Gloves"      }
    ]
  }
}
```

**Status Codes:** `200 OK` · `404`

---

#### `PUT /api/roles/:id/ppe`

Replace the PPE requirements for a role.

> ⚠️ **Replace operation** — the list sent completely replaces the current list.

**Caller:** Admin Panel

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | integer | Role ID |

**Request Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `ppe_item_ids` | integer[] | ✅ | Replaces the existing PPE list |

```json
{ "ppe_item_ids": [1, 2, 3] }
```

**200 OK** — Returns the same structure as `GET /api/roles/:id/ppe`.

**Status Codes:** `200 OK` · `404` · `422`

---

### PPE Items

---

#### `GET /api/ppe-items`

List all PPE item types.

**Caller:** Admin Panel

> 💡 The `item_key` values must match exactly with the class labels output by the AI model — coordinate with the AI module team.

**200 OK**
```json
{
  "success": true,
  "data": [
    { "id": 1, "item_key": "hard_hat",     "display_name": "Hard Hat",     "icon_name": "helmet" },
    { "id": 2, "item_key": "safety_vest",  "display_name": "Safety Vest",  "icon_name": "vest"   },
    { "id": 3, "item_key": "gloves",       "display_name": "Gloves",       "icon_name": "glove"  },
    { "id": 4, "item_key": "safety_boots", "display_name": "Safety Boots", "icon_name": "boots"  },
    { "id": 5, "item_key": "face_mask",    "display_name": "Face Mask",    "icon_name": "mask"   }
  ]
}
```

**Status Codes:** `200 OK`

---

#### `GET /api/ppe-items/:id`

Get a single PPE item type by ID.

**Caller:** Admin Panel

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | integer | PPE item ID |

**200 OK**
```json
{
  "success": true,
  "data": { "id": 1, "item_key": "hard_hat", "display_name": "Hard Hat", "icon_name": "helmet" }
}
```

**404 Not Found**
```json
{ "success": false, "error": { "code": 404, "message": "PPE item not found" } }
```

**Status Codes:** `200 OK` · `404`

---

#### `POST /api/ppe-items`

Create a new PPE item type.

**Caller:** Admin Panel

> ⚠️ The `item_key` must match an AI model class label. Coordinate with the AI module team before adding new items.

**Request Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `item_key` | string | ✅ | Must be unique, must match AI model label |
| `display_name` | string | ✅ | Human-readable name |
| `icon_name` | string | ❌ | Icon identifier for UI |

```json
{
  "item_key": "safety_goggles",
  "display_name": "Safety Goggles",
  "icon_name": "goggles"
}
```

**201 Created**
```json
{
  "success": true,
  "data": {
    "id": 6,
    "item_key": "safety_goggles",
    "display_name": "Safety Goggles",
    "icon_name": "goggles"
  }
}
```

**Error Responses**

| Status | Message |
|---|---|
| `409` | `"item_key already exists"` |
| `422` | `"item_key is required"` |

**Status Codes:** `201 Created` · `409` · `422`

---

#### `PUT /api/ppe-items/:id`

Update a PPE item type. Only the fields sent will be updated.

**Caller:** Admin Panel

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | integer | PPE item ID |

**Request Body** *(all fields optional)*

| Field | Type | Notes |
|---|---|---|
| `item_key` | string | Unique constraint applies |
| `display_name` | string | |
| `icon_name` | string | |

```json
{
  "display_name": "Hard Hat (v2)",
  "icon_name": "helmet_v2"
}
```

**200 OK** — Returns the updated PPE item object (same shape as `GET /api/ppe-items/:id`).

**Status Codes:** `200 OK` · `404` · `409`

---

#### `DELETE /api/ppe-items/:id`

Delete a PPE item type. Will fail if the item is currently assigned to any role.

**Caller:** Admin Panel

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | integer | PPE item ID |

**200 OK**
```json
{ "success": true, "message": "PPE item deleted", "data": { "id": 1 } }
```

**Error Responses**

| Status | Message |
|---|---|
| `404` | `"PPE item not found"` |
| `409` | `"Cannot delete: PPE item is assigned to N role(s). Remove it from all roles first."` |

**Status Codes:** `200 OK` · `404` · `409`

---

### Entry Logs

---

#### `POST /api/entry-logs`

⚡ **Critical RPi endpoint — Step 6 of the inspection flow.**

Called by the RPi **after** it has made the PASS/FAIL decision and operated the turnstile. The backend writes to both the `entry_logs` and `detection_details` tables within a single transaction.

**Caller:** Raspberry Pi (Step 6)

**Request Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `worker_id` | integer \| null | ✅ | `null` for unknown cards |
| `rfid_uid_scanned` | string | ✅ | Raw UID read by RC522 |
| `result` | string | ✅ | `"PASS"`, `"FAIL"`, or `"UNKNOWN_CARD"` |
| `inspection_time_ms` | integer | ❌ | Time taken for inspection in ms |
| `camera_snapshot_url` | string | ❌ | Path to saved snapshot image |
| `detections` | array | ✅ | Empty array for `UNKNOWN_CARD` |

**`detections` item fields**

| Field | Type | Notes |
|---|---|---|
| `ppe_item_id` | integer | References a PPE item |
| `was_required` | boolean | Whether the role required this item |
| `was_detected` | boolean | Whether AI detected it |
| `confidence` | float \| null | AI confidence score; `null` when `was_detected = false` |

**PASS Example** — all PPE present, entry granted
```json
{
  "worker_id": 1,
  "rfid_uid_scanned": "A3F2C1D4",
  "result": "PASS",
  "inspection_time_ms": 4200,
  "camera_snapshot_url": "/snapshots/20260320_091500.jpg",
  "detections": [
    { "ppe_item_id": 1, "was_required": true, "was_detected": true,  "confidence": 0.97 },
    { "ppe_item_id": 2, "was_required": true, "was_detected": true,  "confidence": 0.91 },
    { "ppe_item_id": 3, "was_required": true, "was_detected": true,  "confidence": 0.88 }
  ]
}
```

**FAIL Example** — missing PPE, entry denied
```json
{
  "worker_id": 1,
  "rfid_uid_scanned": "A3F2C1D4",
  "result": "FAIL",
  "inspection_time_ms": 5100,
  "detections": [
    { "ppe_item_id": 1, "was_required": true, "was_detected": true,  "confidence": 0.94 },
    { "ppe_item_id": 2, "was_required": true, "was_detected": true,  "confidence": 0.89 },
    { "ppe_item_id": 3, "was_required": true, "was_detected": false, "confidence": null }
  ]
}
```

**UNKNOWN_CARD Example** — unregistered card, no detections
```json
{
  "worker_id": null,
  "rfid_uid_scanned": "UNKNOWN99",
  "result": "UNKNOWN_CARD",
  "detections": []
}
```

**201 Created**
```json
{
  "success": true,
  "data": {
    "entry_log_id": 142,
    "result": "FAIL",
    "scanned_at": "2026-03-20T09:15:00Z",
    "missing_ppe": [
      { "item_key": "gloves", "display_name": "Gloves", "icon_name": "glove" }
    ]
  }
}
```

**Status Codes:** `201 Created` · `422`

---

#### `GET /api/entry-logs`

Query entry log history.

**Caller:** Admin Panel

**Query Parameters** *(all optional)*

| Parameter | Type | Description |
|---|---|---|
| `worker_id` | integer | Filter by worker |
| `result` | string | Filter by result: `PASS`, `FAIL`, `UNKNOWN_CARD` |
| `start_date` | date | Start of date range (`YYYY-MM-DD`) |
| `end_date` | date | End of date range (`YYYY-MM-DD`) |
| `limit` | integer | Pagination limit (default: 50) |
| `offset` | integer | Pagination offset (default: 0) |

**Example Request**
```
GET /api/entry-logs?worker_id=1&result=FAIL&start_date=2026-03-01&end_date=2026-03-20&limit=50&offset=0
```

**200 OK**
```json
{
  "success": true,
  "data": [
    {
      "id": 142,
      "worker_id": 1,
      "worker_name": "Ali Yılmaz",
      "rfid_uid_scanned": "A3F2C1D4",
      "result": "FAIL",
      "scanned_at": "2026-03-20T09:15:00Z",
      "inspection_time_ms": 5100,
      "camera_snapshot_url": null,
      "missing_ppe": [
        { "item_key": "gloves", "display_name": "Gloves" }
      ]
    }
  ],
  "total": 387,
  "limit": 50,
  "offset": 0
}
```

**Status Codes:** `200 OK`

---

#### `GET /api/entry-logs/stats`

Get compliance dashboard statistics.

**Caller:** Admin Panel

**Query Parameters** *(all optional — omit for all-time stats)*

| Parameter | Type | Description |
|---|---|---|
| `start_date` | date | Start of date range (`YYYY-MM-DD`) |
| `end_date` | date | End of date range (`YYYY-MM-DD`) |

**Example Request**
```
GET /api/entry-logs/stats?start_date=2026-03-01&end_date=2026-03-20
```

**200 OK**
```json
{
  "success": true,
  "data": {
    "total_scans": 387,
    "passed": 301,
    "failed": 74,
    "unknown_cards": 12,
    "compliance_rate": 77.8,
    "most_missed_ppe": [
      { "item_key": "gloves",       "display_name": "Gloves",       "miss_count": 48 },
      { "item_key": "safety_boots", "display_name": "Safety Boots", "miss_count": 21 },
      { "item_key": "face_mask",    "display_name": "Face Mask",    "miss_count": 9  }
    ],
    "period": {
      "start_date": "2026-03-01",
      "end_date": "2026-03-20"
    }
  }
}
```

> `compliance_rate` is calculated as: `passed / (passed + failed) * 100`

**Status Codes:** `200 OK`

---

## Endpoint Summary

| Method | Endpoint | Caller | Description |
|---|---|---|---|
| `GET` | `/api/workers` | Admin Panel | List all workers |
| `POST` | `/api/workers` | Admin Panel | Create a new worker |
| `GET` | `/api/workers/:id` | Admin Panel | Get worker by ID |
| `PUT` | `/api/workers/:id` | Admin Panel | Partial update worker |
| `DELETE` | `/api/workers/:id` | Admin Panel | Soft-delete worker |
| `GET` | `/api/workers/card/:uid` | **RPi · Step 2** | Validate RFID card + required PPE |
| `GET` | `/api/roles` | Admin Panel | List all roles |
| `POST` | `/api/roles` | Admin Panel | Create a new role |
| `GET` | `/api/roles/:id/ppe` | Admin Panel | Get required PPE for a role |
| `PUT` | `/api/roles/:id/ppe` | Admin Panel | Replace PPE requirements for a role |
| `GET` | `/api/ppe-items` | Admin Panel | List all PPE item types |
| `GET` | `/api/ppe-items/:id` | Admin Panel | Get PPE item by ID |
| `POST` | `/api/ppe-items` | Admin Panel | Create a new PPE item type |
| `PUT` | `/api/ppe-items/:id` | Admin Panel | Update a PPE item type |
| `DELETE` | `/api/ppe-items/:id` | Admin Panel | Delete a PPE item type |
| `POST` | `/api/entry-logs` | **RPi · Step 6** | Save inspection result |
| `GET` | `/api/entry-logs` | Admin Panel | Query log history |
| `GET` | `/api/entry-logs/stats` | Admin Panel | Compliance dashboard stats |