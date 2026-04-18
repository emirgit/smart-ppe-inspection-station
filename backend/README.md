# MODULE_4_BACKEND_DATABASE — Backend & Database Module

## Module Purpose
This module provides the central REST API, database access, and PPE entry decision data flow for the turnstile system.

## Authors
- Ahmet Emre Kurt — Student ID: 220104004016
- H. Elyesa Yesilyurt — Student ID: 210104004080

## Dependencies
- Internal modules:
  - Module 1 (AI Detection Module): sends detected PPE list used in access decisions
  - Module 3 (Raspberry Pi / Turnstile Flow): calls RFID lookup and entry-log endpoints
  - Module 5 (Admin Panel): uses worker, role, and reporting endpoints
- Runtime and libraries:
  - Node.js 20.x
  - Express 5.x
  - Prisma ORM
  - PostgreSQL
  - CORS
  - Helmet
  - dotenv
  - swagger-ui-express

## Quick-Start Integration Example
The example below shows a minimal C++ client integration that calls two core public APIs: RFID card lookup and entry-log write.

```cpp
#include <curl/curl.h>
#include <iostream>
#include <string>

int main() {
    CURL* curl = curl_easy_init();
    if (!curl) return 1;

    // 1) Lookup worker by RFID card UID
    curl_easy_setopt(curl, CURLOPT_URL, "{BACKEND_API_URL}/api/workers/card/A3F2C1D4");
    CURLcode res = curl_easy_perform(curl);
    if (res != CURLE_OK) {
        std::cerr << "Lookup request failed: " << curl_easy_strerror(res) << "\n";
        curl_easy_cleanup(curl);
        return 1;
    }

    // 2) Write entry log (minimal payload)
    const char* payload =
        "{"
        "\"worker_id\":1,"
        "\"rfid_uid_scanned\":\"A3F2C1D4\","
        "\"result\":\"PASS\","
        "\"detections\":[{"
        "\"ppe_item_id\":1,\"was_required\":true,\"was_detected\":true,\"confidence\":0.97"
        "}]"
        "}";

    struct curl_slist* headers = nullptr;
    headers = curl_slist_append(headers, "Content-Type: application/json");
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_URL, "{BACKEND_API_URL}/api/entry-logs");
    curl_easy_setopt(curl, CURLOPT_POST, 1L);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, payload);

    res = curl_easy_perform(curl);
    if (res != CURLE_OK) {
        std::cerr << "Entry-log request failed: " << curl_easy_strerror(res) << "\n";
    }

    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
    return 0;
}
```

## API Summary
Public interface for this module is the REST API below.

| Public Function (Endpoint) | Parameters | Return Value |
|---|---|---|
| GET /api/health | None | 200 JSON: status, timestamp |
| GET /api/workers | Query: is_active (bool, optional), role_id (int, optional) | 200 JSON: WorkersListResponse |
| POST /api/workers | Body: CreateWorkerRequest | 201 JSON: WorkerSingleResponse; errors 404, 409, 422 |
| GET /api/workers/{id} | Path: id (int) | 200 JSON: WorkerSingleResponse; 404 ErrorEnvelope |
| PUT /api/workers/{id} | Path: id (int), Body: UpdateWorkerRequest | 200 JSON: WorkerSingleResponse; errors 404, 409 |
| DELETE /api/workers/{id} | Path: id (int) | 200 JSON: soft-delete result; 404 ErrorEnvelope |
| GET /api/workers/card/{uid} | Path: uid (string) | 200 JSON: WorkerCardLookupResponse; 404 ErrorEnvelope |
| GET /api/roles | None | 200 JSON: RolesListResponse |
| POST /api/roles | Body: CreateRoleRequest | 201 JSON: RoleSingleResponse; errors 409, 422 |
| GET /api/roles/{id}/ppe | Path: id (int) | 200 JSON: RolePpeResponse; 404 ErrorEnvelope |
| PUT /api/roles/{id}/ppe | Path: id (int), Body: ppe_item_ids (int[]) | 200 JSON: RolePpeResponse; errors 404, 422 |
| GET /api/ppe-items | None | 200 JSON: PpeItemsListResponse |
| POST /api/entry-logs | Body: CreateEntryLogRequest | 201 JSON: EntryLogCreateResponse; 422 ErrorEnvelope |
| GET /api/entry-logs | Query: worker_id, result, start_date, end_date, limit, offset | 200 JSON: EntryLogsListResponse |
| GET /api/entry-logs/stats | Query: start_date, end_date | 200 JSON: EntryLogStatsResponse (includes daily_data: [{ date, pass, fail, rate }]) |

## Known Limitations and TODOs
- Access decision comparison logic depends on consistent PPE item keys between AI labels and database item_key values.
- Current API contract does not include authentication and authorization headers; add role-based auth for production use.
- Add idempotency strategy for repeated entry-log submissions from unstable network clients.
- Add request-rate limiting and audit trails for admin write operations.
- Add integration tests that validate Module 3 and Module 5 workflows over local network.

## Version History
This section mirrors module-level API/header changelog intent.

| Version | Date | Changes |
|---|---|---|
| 1.2.0 | 2026-03-28 | Added daily_data field to /api/entry-logs/stats response. |
| 1.1.0 | 2026-03-28 | Added/confirmed endpoint contract set in OpenAPI, including worker, role, PPE, and entry-log routes. |
| 1.0.0 | 2026-03-20 | Initial backend/database module baseline: REST server, schema, and core data models. |
