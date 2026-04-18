"""
models.py
=========
MOD-03 IoT Module — Shared Data Types

Defines the data contracts exchanged between MOD-03 and other modules.
No implementation logic — pure data definitions only.

Authors : Alperen Söylen       (220104004024) — Primary
          Zeynep Etik          (220104004035) — Secondary
          Mümincan Durak       (210104004057) — Secondary
          Emre İlhan Şenel    (230104004907) — Secondary
          Hüseyin Elyesa Yeşilyurt (210104004080) — Secondary
Date    : 2026-03-29
Version : 0.3

Changelog:
    v0.1 (2026-03-29) — Initial draft as concrete implementation classes
    v0.2 (2026-03-29) — Rewritten as pure data definitions (no implementation methods)
    v0.3 (2026-03-29) — AccessDecision aligned with MOD-04 EntryResult
                           (GRANTED→PASS, DENIED→FAIL, added UNKNOWN_CARD);
                           added TODO notes for cross-module PPE naming contracts

─────────────────────────────────────────────────────────────
CROSS-MODULE TODOS
─────────────────────────────────────────────────────────────
TODO (Conflict 1 — MOD-03 ↔ MOD-01 ↔ MOD-04):
    PPE naming contract not yet agreed.
    MOD-01 (AI Vision) produces detection labels as PPEClass enum values
    (e.g. PPEClass.HELMET, PPEClass.VEST).
    MOD-04 (Backend) stores and returns PPE items identified by string
    item_key values (e.g. "HELMET", "VEST") in RequiredPpeItem.item_key.
    Before integration, all three teams must agree on:
      a) whether item_key strings are guaranteed to match PPEClass names exactly, or
      b) a shared mapping table / normalization function is required.

TODO (Conflict 2 — MOD-03 ↔ MOD-04):
    PPE item identifier mismatch not yet resolved.
    MOD-04 identifies PPE items by database integer IDs (RequiredPpeItem.id,
    DetectionItem.ppe_item_id) ranging from 1..N.
    MOD-01 (AI Vision) identifies PPE classes by PPEClass enum integer values
    (0..10 in the current definition).
    These two ID spaces are different and must NOT be used interchangeably.
    Before integration, MOD-03 and MOD-04 must agree on a mapping strategy
    (e.g. MOD-03 sends item_key strings and MOD-04 resolves IDs server-side).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import IntEnum
from typing import Optional


# =============================================================================
# ENUM: ACCESS DECISION
# =============================================================================

class AccessDecision(IntEnum):
    """
    Final access decision produced by the IoT orchestration flow.

    Values are aligned with MOD-04's EntryResult type so that
    BackendClient.log_entry() can map this enum directly to the
    'result' field of CreateEntryLogRequest without conversion.

    MOD-04 EntryResult mapping:
        PASS         → 'PASS'         (all required PPE detected)
        FAIL         → 'FAIL'         (one or more required PPE items missing)
        UNKNOWN_CARD → 'UNKNOWN_CARD' (RFID card not registered in backend)
    """
    FAIL         = 0  # One or more required PPE items missing
    PASS         = 1  # All required PPE items detected
    UNKNOWN_CARD = 2  # RFID card not registered in the backend


# =============================================================================
# DATACLASS: WORKER INFO (received from MOD-04 backend)
# =============================================================================

@dataclass
class RequiredPpeItem:
    id: int
    item_key: str
    display_name: Optional[str] = None
    icon_name: Optional[str] = None


@dataclass
class WorkerInfo:
    """
    Worker profile returned by the backend for a given RFID card.

    Received from BackendClient.get_worker().
    required_ppe is the list of PPE items the worker must wear
    for their assigned role.
    """
    worker_id:    int
    worker_name:  str
    role:         str
    required_ppe: list[RequiredPpeItem] = field(default_factory=list)


# =============================================================================
# DATACLASS: ENTRY LOG (sent to MOD-04 backend)
# =============================================================================

@dataclass
class DetectionItem:
    ppe_item_id: int
    was_required: bool
    was_detected: bool
    confidence: Optional[float] = None

@dataclass
class EntryLog:
    """
    Record of a single access attempt sent to the backend for auditing.
    """
    card_id:      str
    worker_id:    Optional[int]
    decision:     AccessDecision
    detected_ppe: list[str] = field(default_factory=list)
    missing_ppe:  list[str] = field(default_factory=list)
    detections:   list[DetectionItem] = field(default_factory=list)
    timestamp_ms: int = 0
