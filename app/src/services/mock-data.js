export const ppeItems = [
  { id: 1, item_key: 'HELMET',  display_name: 'Baret',            icon_name: 'hard-hat' },
  { id: 2, item_key: 'VEST',    display_name: 'Güvenlik Yeleği',  icon_name: 'vest' },
  { id: 3, item_key: 'GLOVES',  display_name: 'Eldiven',          icon_name: 'gloves' },
  { id: 4, item_key: 'BOOTS',   display_name: 'Güvenlik Botu',    icon_name: 'boots' },
  { id: 5, item_key: 'GOGGLES', display_name: 'Koruyucu Gözlük', icon_name: 'goggles' },
];

export const roles = [
  { id: 1, role_name: 'Construction Worker', description: 'Genel inşaat alanı işçisi', required_ppe: [1, 2, 3, 4], created_at: '2026-01-15T08:00:00Z' },
  { id: 2, role_name: 'Technician',          description: 'Ekipman bakım teknisyeni',   required_ppe: [1, 2, 5],    created_at: '2026-01-15T08:00:00Z' },
  { id: 3, role_name: 'Visitor',             description: 'Temel PPE gerektiren ziyaretçi', required_ppe: [1, 2],  created_at: '2026-01-15T08:00:00Z' },
  { id: 4, role_name: 'Electrician',         description: 'Elektrik sistemleri çalışanı',  required_ppe: [1, 2, 3, 5], created_at: '2026-01-15T08:00:00Z' },
];

export const workers = [
  { id: 1, full_name: 'Ahmet Yılmaz',   rfid_card_uid: 'A1B2C3D4', role_id: 1, role_name: 'Construction Worker', is_active: true,  photo_url: null, created_at: '2026-03-01T08:00:00Z' },
  { id: 2, full_name: 'Fatma Demir',    rfid_card_uid: 'E5F6G7H8', role_id: 2, role_name: 'Technician',          is_active: true,  photo_url: null, created_at: '2026-03-02T09:30:00Z' },
  { id: 3, full_name: 'Mehmet Kaya',    rfid_card_uid: 'I9J0K1L2', role_id: 3, role_name: 'Visitor',             is_active: true,  photo_url: null, created_at: '2026-03-05T10:00:00Z' },
  { id: 4, full_name: 'Zeynep Aydın',   rfid_card_uid: 'M3N4O5P6', role_id: 4, role_name: 'Electrician',         is_active: true,  photo_url: null, created_at: '2026-03-08T11:15:00Z' },
  { id: 5, full_name: 'Ali Çelik',      rfid_card_uid: 'Q7R8S9T0', role_id: 1, role_name: 'Construction Worker', is_active: false, photo_url: null, created_at: '2026-02-20T07:00:00Z' },
  { id: 6, full_name: 'Elif Yıldız',    rfid_card_uid: 'U1V2W3X4', role_id: 2, role_name: 'Technician',          is_active: true,  photo_url: null, created_at: '2026-03-10T08:45:00Z' },
  { id: 7, full_name: 'Hasan Özdemir',  rfid_card_uid: 'Y5Z6A7B8', role_id: 1, role_name: 'Construction Worker', is_active: true,  photo_url: null, created_at: '2026-03-12T09:00:00Z' },
  { id: 8, full_name: 'Ayşe Koç',       rfid_card_uid: 'C9D0E1F2', role_id: 3, role_name: 'Visitor',             is_active: true,  photo_url: null, created_at: '2026-03-15T14:00:00Z' },
];

export const entryLogs = [
  { id: 1,  worker_id: 1, worker_name: 'Ahmet Yılmaz',  rfid_uid_scanned: 'A1B2C3D4', result: 'PASS', missing_ppe: [], scanned_at: '2026-04-29T08:15:00Z', inspection_time_ms: 3200 },
  { id: 2,  worker_id: 2, worker_name: 'Fatma Demir',   rfid_uid_scanned: 'E5F6G7H8', result: 'FAIL', missing_ppe: [{ item_key: 'GOGGLES', display_name: 'Koruyucu Gözlük' }], scanned_at: '2026-04-29T08:22:00Z', inspection_time_ms: 4100 },
  { id: 3,  worker_id: 1, worker_name: 'Ahmet Yılmaz',  rfid_uid_scanned: 'A1B2C3D4', result: 'PASS', missing_ppe: [], scanned_at: '2026-04-29T09:00:00Z', inspection_time_ms: 2800 },
  { id: 4,  worker_id: null, worker_name: null,          rfid_uid_scanned: 'UNKNOWN01', result: 'UNKNOWN_CARD', missing_ppe: [], scanned_at: '2026-04-29T09:15:00Z', inspection_time_ms: null },
  { id: 5,  worker_id: 3, worker_name: 'Mehmet Kaya',   rfid_uid_scanned: 'I9J0K1L2', result: 'PASS', missing_ppe: [], scanned_at: '2026-04-29T09:30:00Z', inspection_time_ms: 2100 },
  { id: 6,  worker_id: 4, worker_name: 'Zeynep Aydın',  rfid_uid_scanned: 'M3N4O5P6', result: 'FAIL', missing_ppe: [{ item_key: 'GLOVES', display_name: 'Eldiven' }, { item_key: 'GOGGLES', display_name: 'Koruyucu Gözlük' }], scanned_at: '2026-04-29T10:05:00Z', inspection_time_ms: 3900 },
  { id: 7,  worker_id: 2, worker_name: 'Fatma Demir',   rfid_uid_scanned: 'E5F6G7H8', result: 'PASS', missing_ppe: [], scanned_at: '2026-04-29T10:30:00Z', inspection_time_ms: 2500 },
  { id: 8,  worker_id: 1, worker_name: 'Ahmet Yılmaz',  rfid_uid_scanned: 'A1B2C3D4', result: 'FAIL', missing_ppe: [{ item_key: 'GLOVES', display_name: 'Eldiven' }], scanned_at: '2026-04-28T08:10:00Z', inspection_time_ms: 3600 },
  { id: 9,  worker_id: 3, worker_name: 'Mehmet Kaya',   rfid_uid_scanned: 'I9J0K1L2', result: 'PASS', missing_ppe: [], scanned_at: '2026-04-28T09:20:00Z', inspection_time_ms: 1900 },
  { id: 10, worker_id: 4, worker_name: 'Zeynep Aydın',  rfid_uid_scanned: 'M3N4O5P6', result: 'PASS', missing_ppe: [], scanned_at: '2026-04-28T10:00:00Z', inspection_time_ms: 2700 },
  { id: 11, worker_id: 7, worker_name: 'Hasan Özdemir', rfid_uid_scanned: 'Y5Z6A7B8', result: 'PASS', missing_ppe: [], scanned_at: '2026-04-28T11:30:00Z', inspection_time_ms: 2400 },
  { id: 12, worker_id: 6, worker_name: 'Elif Yıldız',   rfid_uid_scanned: 'U1V2W3X4', result: 'FAIL', missing_ppe: [{ item_key: 'GOGGLES', display_name: 'Koruyucu Gözlük' }], scanned_at: '2026-04-27T08:45:00Z', inspection_time_ms: 3700 },
  { id: 13, worker_id: 1, worker_name: 'Ahmet Yılmaz',  rfid_uid_scanned: 'A1B2C3D4', result: 'PASS', missing_ppe: [], scanned_at: '2026-04-27T09:10:00Z', inspection_time_ms: 2600 },
  { id: 14, worker_id: 8, worker_name: 'Ayşe Koç',      rfid_uid_scanned: 'C9D0E1F2', result: 'PASS', missing_ppe: [], scanned_at: '2026-04-27T14:20:00Z', inspection_time_ms: 1800 },
  { id: 15, worker_id: 4, worker_name: 'Zeynep Aydın',  rfid_uid_scanned: 'M3N4O5P6', result: 'FAIL', missing_ppe: [{ item_key: 'GLOVES', display_name: 'Eldiven' }], scanned_at: '2026-04-26T08:30:00Z', inspection_time_ms: 3500 },
  { id: 16, worker_id: 7, worker_name: 'Hasan Özdemir', rfid_uid_scanned: 'Y5Z6A7B8', result: 'PASS', missing_ppe: [], scanned_at: '2026-04-26T09:00:00Z', inspection_time_ms: 2400 },
  { id: 17, worker_id: 2, worker_name: 'Fatma Demir',   rfid_uid_scanned: 'E5F6G7H8', result: 'PASS', missing_ppe: [], scanned_at: '2026-04-25T10:15:00Z', inspection_time_ms: 2300 },
  { id: 18, worker_id: 3, worker_name: 'Mehmet Kaya',   rfid_uid_scanned: 'I9J0K1L2', result: 'FAIL', missing_ppe: [{ item_key: 'VEST', display_name: 'Güvenlik Yeleği' }], scanned_at: '2026-04-25T11:00:00Z', inspection_time_ms: 3100 },
  { id: 19, worker_id: 1, worker_name: 'Ahmet Yılmaz',  rfid_uid_scanned: 'A1B2C3D4', result: 'PASS', missing_ppe: [], scanned_at: '2026-04-24T08:00:00Z', inspection_time_ms: 2500 },
  { id: 20, worker_id: 4, worker_name: 'Zeynep Aydın',  rfid_uid_scanned: 'M3N4O5P6', result: 'PASS', missing_ppe: [], scanned_at: '2026-04-23T09:30:00Z', inspection_time_ms: 2700 },
];
