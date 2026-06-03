const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/__mocks__/config/prisma');

beforeEach(() => {
  prisma.__resetAllMocks();
});

// ─── Helper Fixtures ─────────────────────────────────────
const mockPpeItem = {
  id: 1,
  itemKey: 'hard_hat',
  displayName: 'Hard Hat',
  iconName: 'hardhat',
};

const mockEntryLogRaw = {
  id: 1,
  workerId: 1,
  rfidUidScanned: 'ABC123',
  result: 'PASS',
  inspectionTimeMs: 250,
  cameraSnapshotUrl: null,
  scannedAt: new Date('2026-04-10T10:00:00Z'),
  detectionDetails: [
    {
      ppeItemId: 1,
      wasRequired: true,
      wasDetected: true,
      confidence: 0.95,
      ppeItem: mockPpeItem,
    },
  ],
};

// ─── POST /api/entry-logs ────────────────────────────────
describe('POST /api/entry-logs', () => {
  it('should create an entry log (201)', async () => {
    prisma.$transaction.mockImplementation(async (cb) => {
      return cb({
        entryLog: {
          create: jest.fn().mockResolvedValue(mockEntryLogRaw),
        },
      });
    });

    const res = await request(app)
      .post('/api/entry-logs')
      .send({
        worker_id: 1,
        rfid_uid_scanned: 'ABC123',
        result: 'PASS',
        inspection_time_ms: 250,
        detections: [
          {
            ppe_item_id: 1,
            was_required: true,
            was_detected: true,
            confidence: 0.95,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.entry_log_id).toBe(1);
    expect(res.body.data.result).toBe('PASS');
    expect(res.body.data.missing_ppe).toHaveLength(0);
  });

  it('should include missing PPE in response when result is FAIL', async () => {
    const failLog = {
      ...mockEntryLogRaw,
      result: 'FAIL',
      detectionDetails: [
        {
          ppeItemId: 1,
          wasRequired: true,
          wasDetected: false,
          confidence: 0.1,
          ppeItem: mockPpeItem,
        },
      ],
    };
    prisma.$transaction.mockImplementation(async (cb) => {
      return cb({
        entryLog: {
          create: jest.fn().mockResolvedValue(failLog),
        },
      });
    });

    const res = await request(app)
      .post('/api/entry-logs')
      .send({
        worker_id: 1,
        rfid_uid_scanned: 'ABC123',
        result: 'FAIL',
        detections: [
          { ppe_item_id: 1, was_required: true, was_detected: false, confidence: 0.1 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.result).toBe('FAIL');
    expect(res.body.data.missing_ppe).toHaveLength(1);
    expect(res.body.data.missing_ppe[0].item_key).toBe('hard_hat');
  });

  it('should return 422 when rfid_uid_scanned is missing', async () => {
    const res = await request(app)
      .post('/api/entry-logs')
      .send({ result: 'PASS', detections: [] });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/rfid_uid_scanned/i);
  });

  it('should return 422 when result is invalid', async () => {
    const res = await request(app)
      .post('/api/entry-logs')
      .send({ rfid_uid_scanned: 'ABC123', result: 'INVALID', detections: [] });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/result must be/i);
  });

  it('should return 422 when detections is not an array', async () => {
    const res = await request(app)
      .post('/api/entry-logs')
      .send({ rfid_uid_scanned: 'ABC123', result: 'PASS', detections: 'not-array' });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/detections/i);
  });

  it('should return 422 when detections is missing', async () => {
    const res = await request(app)
      .post('/api/entry-logs')
      .send({ rfid_uid_scanned: 'ABC123', result: 'PASS' });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/detections/i);
  });
});

// ─── GET /api/entry-logs ─────────────────────────────────
describe('GET /api/entry-logs', () => {
  it('should return entry logs with pagination', async () => {
    const logWithWorker = {
      ...mockEntryLogRaw,
      worker: { fullName: 'John Doe' },
    };
    prisma.entryLog.findMany.mockResolvedValue([logWithWorker]);
    prisma.entryLog.count.mockResolvedValue(1);

    const res = await request(app).get('/api/entry-logs');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: 1,
      worker_name: 'John Doe',
      result: 'PASS',
    });
    expect(res.body.total).toBe(1);
    expect(res.body.limit).toBe(50);
    expect(res.body.offset).toBe(0);
  });

  it('should filter by worker_id and result', async () => {
    prisma.entryLog.findMany.mockResolvedValue([]);
    prisma.entryLog.count.mockResolvedValue(0);

    const res = await request(app).get('/api/entry-logs?worker_id=1&result=FAIL');

    expect(res.status).toBe(200);
    expect(prisma.entryLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workerId: 1,
          result: 'FAIL',
        }),
      })
    );
  });

  it('should apply limit and offset', async () => {
    prisma.entryLog.findMany.mockResolvedValue([]);
    prisma.entryLog.count.mockResolvedValue(0);

    const res = await request(app).get('/api/entry-logs?limit=10&offset=5');

    expect(res.status).toBe(200);
    expect(prisma.entryLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        skip: 5,
      })
    );
    expect(res.body.limit).toBe(10);
    expect(res.body.offset).toBe(5);
  });

  it('should filter by date range', async () => {
    prisma.entryLog.findMany.mockResolvedValue([]);
    prisma.entryLog.count.mockResolvedValue(0);

    const res = await request(app).get(
      '/api/entry-logs?start_date=2026-04-01&end_date=2026-04-10'
    );

    expect(res.status).toBe(200);
    expect(prisma.entryLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          scannedAt: expect.objectContaining({
            gte: expect.any(Date),
            lt: expect.any(Date),
          }),
        }),
      })
    );
  });
});

// ─── GET /api/entry-logs/stats ───────────────────────────
describe('GET /api/entry-logs/stats', () => {
  it('should return scan statistics', async () => {
    prisma.entryLog.count
      .mockResolvedValueOnce(80)  // passed
      .mockResolvedValueOnce(15)  // failed
      .mockResolvedValueOnce(5)   // unknown cards
      .mockResolvedValueOnce(100); // total scans
    prisma.detectionDetail.groupBy.mockResolvedValue([
      { ppeItemId: 1, _count: { ppeItemId: 10 } },
    ]);
    prisma.ppeItem.findMany.mockResolvedValue([mockPpeItem]);

    const res = await request(app).get('/api/entry-logs/stats');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      total_scans: 100,
      passed: 80,
      failed: 15,
      unknown_cards: 5,
      compliance_rate: expect.any(Number),
    });
    // compliance_rate = 80 / (80 + 15) * 100 = 84.2
    expect(res.body.data.compliance_rate).toBeCloseTo(84.2, 1);
    expect(res.body.data.most_missed_ppe).toHaveLength(1);
    expect(res.body.data.most_missed_ppe[0].item_key).toBe('hard_hat');
  });

  it('should return 0 compliance_rate when no pass/fail logs exist', async () => {
    prisma.entryLog.count
      .mockResolvedValueOnce(0)  // passed
      .mockResolvedValueOnce(0)  // failed
      .mockResolvedValueOnce(0)  // unknown
      .mockResolvedValueOnce(0); // total
    prisma.detectionDetail.groupBy.mockResolvedValue([]);

    const res = await request(app).get('/api/entry-logs/stats');

    expect(res.status).toBe(200);
    expect(res.body.data.compliance_rate).toBe(0);
    expect(res.body.data.most_missed_ppe).toHaveLength(0);
  });

  it('should accept date range parameters', async () => {
    prisma.entryLog.count.mockResolvedValue(0);
    prisma.detectionDetail.groupBy.mockResolvedValue([]);

    const res = await request(app).get(
      '/api/entry-logs/stats?start_date=2026-04-01&end_date=2026-04-10'
    );

    expect(res.status).toBe(200);
    expect(res.body.data.period).toMatchObject({
      start_date: '2026-04-01',
      end_date: '2026-04-10',
    });
  });
});
