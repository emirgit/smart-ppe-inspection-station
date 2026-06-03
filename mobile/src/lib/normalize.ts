/**
 * @file    normalize.ts
 * @brief   Defensive normalization for inbound DisplayMessages.
 *
 * MOD-03 (RPi) and MOD-05 (display) have several known schema
 * mismatches documented in doc/compatibility.md (C-04, C-08).
 * Rather than crashing when the RPi sends a slightly different
 * payload shape, the display normalizes everything into the
 * DisplayMessage union declared in display_interface.ts.
 */
import {
  DisplayState,
  type DisplayMessage,
  type RequiredPpeItem,
} from '../interfaces/display_interface';

export interface DisplayWorker {
  id: number;
  full_name: string;
  photo_url: string | null;
  role_name: string;
}

const STATE_ALIASES: Record<string, DisplayState> = {
  IDLE: DisplayState.IDLE,
  IDENTIFYING: DisplayState.IDENTIFYING,
  UNKNOWN_CARD: DisplayState.UNKNOWN_CARD,
  INSPECTING: DisplayState.INSPECTING,
  PASS: DisplayState.PASS,
  GRANTED: DisplayState.PASS,
  FAIL: DisplayState.FAIL,
  DENIED: DisplayState.FAIL,
};

export function normalizeState(raw: unknown): DisplayState | null {
  if (typeof raw !== 'string') return null;
  return STATE_ALIASES[raw.toUpperCase()] ?? null;
}

function titleCase(itemKey: string): string {
  return itemKey
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizePpe(items: unknown): RequiredPpeItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index): RequiredPpeItem | null => {
      if (typeof item === 'string') {
        return {
          id: index,
          item_key: item,
          display_name: titleCase(item),
          icon_name: item,
        };
      }
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const itemKey = typeof obj.item_key === 'string' ? obj.item_key : '';
        return {
          id: typeof obj.id === 'number' ? obj.id : index,
          item_key: itemKey,
          display_name:
            typeof obj.display_name === 'string'
              ? obj.display_name
              : titleCase(itemKey),
          icon_name:
            typeof obj.icon_name === 'string' ? obj.icon_name : itemKey,
        };
      }
      return null;
    })
    .filter((x): x is RequiredPpeItem => x !== null);
}

export function normalizeWorker(raw: Record<string, unknown>): DisplayWorker {
  const nested = raw.worker;
  if (nested && typeof nested === 'object') {
    const w = nested as Record<string, unknown>;
    return {
      id: typeof w.id === 'number' ? w.id : 0,
      full_name: typeof w.full_name === 'string' ? w.full_name : 'Unknown',
      photo_url: typeof w.photo_url === 'string' ? w.photo_url : null,
      role_name: typeof w.role_name === 'string' ? w.role_name : 'Worker',
    };
  }
  // Flat fallback (C-04): MOD-03 may transmit only a worker_name string.
  return {
    id: typeof raw.worker_id === 'number' ? raw.worker_id : 0,
    full_name:
      typeof raw.worker_name === 'string'
        ? raw.worker_name
        : typeof raw.workerName === 'string'
          ? raw.workerName
          : 'Unknown',
    photo_url: null,
    role_name:
      typeof raw.role === 'string'
        ? raw.role
        : typeof raw.role_name === 'string'
          ? raw.role_name
          : 'Worker',
  };
}

/**
 * Convert an arbitrary inbound payload into a strongly-typed DisplayMessage.
 * Returns null and logs a warning when the payload cannot be interpreted,
 * so the controller can keep the previous state instead of crashing.
 */
export function normalizeMessage(raw: unknown): DisplayMessage | null {
  if (!raw || typeof raw !== 'object') {
    console.warn('[display] Ignoring non-object message:', raw);
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const state = normalizeState(obj.state);
  if (state === null) {
    console.warn('[display] Ignoring message with unknown state:', obj.state);
    return null;
  }

  switch (state) {
    case DisplayState.IDLE:
      return { state: DisplayState.IDLE };
    case DisplayState.IDENTIFYING:
      return {
        state: DisplayState.IDENTIFYING,
        rfid_card_uid:
          typeof obj.rfid_card_uid === 'string' ? obj.rfid_card_uid : undefined,
      };
    case DisplayState.UNKNOWN_CARD:
      return {
        state: DisplayState.UNKNOWN_CARD,
        rfid_card_uid:
          typeof obj.rfid_card_uid === 'string' ? obj.rfid_card_uid : undefined,
      };
    case DisplayState.INSPECTING:
      return {
        state: DisplayState.INSPECTING,
        worker: normalizeWorker(obj),
        required_ppe: normalizePpe(obj.required_ppe),
        instruction:
          typeof obj.instruction === 'string' ? obj.instruction : undefined,
      };
    case DisplayState.PASS:
      return {
        state: DisplayState.PASS,
        worker: normalizeWorker(obj),
        detected_ppe: normalizePpe(obj.detected_ppe),
      };
    case DisplayState.FAIL:
      return {
        state: DisplayState.FAIL,
        worker: normalizeWorker(obj),
        detected_ppe: normalizePpe(obj.detected_ppe),
        missing_ppe: normalizePpe(obj.missing_ppe),
      };
    case DisplayState.CONNECTION_ERROR:
      // CONNECTION_ERROR is a local-only state; ignore if it ever arrives.
      console.warn(
        '[display] Ignoring CONNECTION_ERROR pushed from network (local-only state).'
      );
      return null;
  }
}
