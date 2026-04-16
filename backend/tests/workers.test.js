const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/__mocks__/config/prisma');

beforeEach(() => {
  prisma.__resetAllMocks();
});

// ─── Helper Fixtures ─────────────────────────────────────
const mockRole = { id: 1, roleName: 'Electrician', description: null, createdAt: new Date() };

const mockWorkerRaw = {
  id: 1,
  fullName: 'John Doe',
  rfidCardUid: 'ABC123',
  roleId: 1,
  isActive: true,
  photoUrl: null,
  createdAt: new Date(),
  updatedAt: null,
  role: mockRole,
};

// ─── GET /api/workers ────────────────────────────────────
describe('GET /api/workers', () => {
  it('should return all workers', async () => {
    prisma.worker.findMany.mockResolvedValue([mockWorkerRaw]);
    prisma.worker.count.mockResolvedValue(1);

    const res = await request(app).get('/api/workers');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: 1,
      full_name: 'John Doe',
      rfid_card_uid: 'ABC123',
      role_id: 1,
      role_name: 'Electrician',
      is_active: true,
    });
    expect(res.body.total).toBe(1);
  });

  it('should filter by is_active query param', async () => {
    prisma.worker.findMany.mockResolvedValue([]);
    prisma.worker.count.mockResolvedValue(0);

    const res = await request(app).get('/api/workers?is_active=false');

    expect(res.status).toBe(200);
    expect(prisma.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: false }),
      })
    );
  });

  it('should filter by role_id query param', async () => {
    prisma.worker.findMany.mockResolvedValue([]);
    prisma.worker.count.mockResolvedValue(0);

    const res = await request(app).get('/api/workers?role_id=2');

    expect(res.status).toBe(200);
    expect(prisma.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ roleId: 2 }),
      })
    );
  });
});

// ─── POST /api/workers ───────────────────────────────────
describe('POST /api/workers', () => {
  it('should create a new worker (201)', async () => {
    prisma.worker.findUnique.mockResolvedValue(null); // no duplicate RFID
    prisma.role.findUnique.mockResolvedValue(mockRole);
    prisma.worker.create.mockResolvedValue(mockWorkerRaw);

    const res = await request(app)
      .post('/api/workers')
      .send({ full_name: 'John Doe', rfid_card_uid: 'ABC123', role_id: 1 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.full_name).toBe('John Doe');
  });

  it('should return 422 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/workers')
      .send({ full_name: 'John Doe' }); // missing rfid_card_uid and role_id

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(422);
  });

  it('should return 409 when RFID is already registered', async () => {
    prisma.worker.findUnique.mockResolvedValue(mockWorkerRaw); // duplicate found

    const res = await request(app)
      .post('/api/workers')
      .send({ full_name: 'Jane Doe', rfid_card_uid: 'ABC123', role_id: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/RFID/i);
  });

  it('should return 404 when role_id does not exist', async () => {
    prisma.worker.findUnique.mockResolvedValue(null); // no duplicate RFID
    prisma.role.findUnique.mockResolvedValue(null); // role not found

    const res = await request(app)
      .post('/api/workers')
      .send({ full_name: 'Jane Doe', rfid_card_uid: 'XYZ789', role_id: 999 });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/Role not found/i);
  });
});

// ─── GET /api/workers/:id ────────────────────────────────
describe('GET /api/workers/:id', () => {
  it('should return a worker by ID', async () => {
    prisma.worker.findUnique.mockResolvedValue(mockWorkerRaw);

    const res = await request(app).get('/api/workers/1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(1);
  });

  it('should return 404 when worker not found', async () => {
    prisma.worker.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/workers/999');

    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/Worker not found/i);
  });
});

// ─── PUT /api/workers/:id ────────────────────────────────
describe('PUT /api/workers/:id', () => {
  it('should update a worker', async () => {
    const updated = { ...mockWorkerRaw, fullName: 'John Updated' };
    prisma.worker.findUnique.mockResolvedValue(mockWorkerRaw);
    prisma.worker.update.mockResolvedValue({ ...updated, role: mockRole });

    const res = await request(app)
      .put('/api/workers/1')
      .send({ full_name: 'John Updated' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.full_name).toBe('John Updated');
  });

  it('should return 404 when worker not found', async () => {
    prisma.worker.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/workers/999')
      .send({ full_name: 'Nobody' });

    expect(res.status).toBe(404);
  });

  it('should return 409 when changing to a duplicate RFID', async () => {
    // First call: find the worker being updated
    // Second call: find duplicate RFID
    prisma.worker.findUnique
      .mockResolvedValueOnce(mockWorkerRaw) // worker exists
      .mockResolvedValueOnce({ id: 2, rfidCardUid: 'DUP999' }); // duplicate found

    const res = await request(app)
      .put('/api/workers/1')
      .send({ rfid_card_uid: 'DUP999' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/RFID/i);
  });
});

// ─── DELETE /api/workers/:id ─────────────────────────────
describe('DELETE /api/workers/:id', () => {
  it('should soft-delete (deactivate) a worker', async () => {
    prisma.worker.findUnique.mockResolvedValue(mockWorkerRaw);
    prisma.worker.update.mockResolvedValue({ ...mockWorkerRaw, isActive: false });

    const res = await request(app).delete('/api/workers/1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/deactivated/i);
    expect(res.body.data.is_active).toBe(false);
  });

  it('should return 404 when worker not found', async () => {
    prisma.worker.findUnique.mockResolvedValue(null);

    const res = await request(app).delete('/api/workers/999');

    expect(res.status).toBe(404);
  });
});

// ─── GET /api/workers/card/:uid ──────────────────────────
describe('GET /api/workers/card/:uid', () => {
  it('should return worker with required PPE', async () => {
    const mockWorkerWithPpe = {
      ...mockWorkerRaw,
      role: {
        ...mockRole,
        rolePpeRequirements: [
          {
            ppeItem: {
              id: 1,
              itemKey: 'hard_hat',
              displayName: 'Hard Hat',
              iconName: 'hardhat',
            },
          },
        ],
      },
    };
    prisma.worker.findUnique.mockResolvedValue(mockWorkerWithPpe);

    const res = await request(app).get('/api/workers/card/ABC123');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.worker.full_name).toBe('John Doe');
    expect(res.body.data.required_ppe).toHaveLength(1);
    expect(res.body.data.required_ppe[0].item_key).toBe('hard_hat');
  });

  it('should return 404 when card is not registered', async () => {
    prisma.worker.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/workers/card/UNKNOWN');

    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/Card not registered/i);
  });
});

// ─── Error Propagation (catch blocks) ────────────────────
describe('Error propagation', () => {
  it('GET /api/workers should return 500 when Prisma throws', async () => {
    prisma.worker.findMany.mockRejectedValue(new Error('DB connection lost'));

    const res = await request(app).get('/api/workers');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/workers should return 500 when Prisma throws', async () => {
    prisma.worker.findUnique.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/workers')
      .send({ full_name: 'Test', rfid_card_uid: 'X1', role_id: 1 });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/workers/:id should return 500 when Prisma throws', async () => {
    prisma.worker.findUnique.mockRejectedValue(new Error('DB error'));

    const res = await request(app).get('/api/workers/1');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('PUT /api/workers/:id should return 500 when Prisma throws', async () => {
    prisma.worker.findUnique.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .put('/api/workers/1')
      .send({ full_name: 'Updated' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('DELETE /api/workers/:id should return 500 when Prisma throws', async () => {
    prisma.worker.findUnique.mockRejectedValue(new Error('DB error'));

    const res = await request(app).delete('/api/workers/1');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/workers/card/:uid should return 500 when Prisma throws', async () => {
    prisma.worker.findUnique.mockRejectedValue(new Error('DB error'));

    const res = await request(app).get('/api/workers/card/ABC123');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

