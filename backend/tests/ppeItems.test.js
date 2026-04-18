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

// ─── GET /api/ppe-items ──────────────────────────────────
describe('GET /api/ppe-items', () => {
  it('should return all PPE items', async () => {
    prisma.ppeItem.findMany.mockResolvedValue([mockPpeItem]);

    const res = await request(app).get('/api/ppe-items');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: 1,
      item_key: 'hard_hat',
      display_name: 'Hard Hat',
      icon_name: 'hardhat',
    });
  });
});

// ─── GET /api/ppe-items/:id ──────────────────────────────
describe('GET /api/ppe-items/:id', () => {
  it('should return a PPE item by ID', async () => {
    prisma.ppeItem.findUnique.mockResolvedValue(mockPpeItem);

    const res = await request(app).get('/api/ppe-items/1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.item_key).toBe('hard_hat');
  });

  it('should return 404 when PPE item not found', async () => {
    prisma.ppeItem.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/ppe-items/999');

    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/PPE item not found/i);
  });
});

// ─── POST /api/ppe-items ─────────────────────────────────
describe('POST /api/ppe-items', () => {
  it('should create a new PPE item (201)', async () => {
    prisma.ppeItem.findUnique.mockResolvedValue(null); // no duplicate
    prisma.ppeItem.create.mockResolvedValue(mockPpeItem);

    const res = await request(app)
      .post('/api/ppe-items')
      .send({ item_key: 'hard_hat', display_name: 'Hard Hat', icon_name: 'hardhat' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.item_key).toBe('hard_hat');
  });

  it('should return 422 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/ppe-items')
      .send({ item_key: 'hard_hat' }); // missing display_name

    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/display_name.*required/i);
  });

  it('should return 422 when all required fields missing', async () => {
    const res = await request(app)
      .post('/api/ppe-items')
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/item_key.*required/i);
  });

  it('should return 409 when item_key already exists', async () => {
    prisma.ppeItem.findUnique.mockResolvedValue(mockPpeItem); // duplicate found

    const res = await request(app)
      .post('/api/ppe-items')
      .send({ item_key: 'hard_hat', display_name: 'Hard Hat' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/item_key already exists/i);
  });
});

// ─── PUT /api/ppe-items/:id ──────────────────────────────
describe('PUT /api/ppe-items/:id', () => {
  it('should update a PPE item', async () => {
    const updated = { ...mockPpeItem, displayName: 'Safety Helmet' };
    prisma.ppeItem.findUnique.mockResolvedValue(mockPpeItem); // exists
    prisma.ppeItem.update.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/ppe-items/1')
      .send({ display_name: 'Safety Helmet' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 404 when PPE item not found', async () => {
    prisma.ppeItem.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/ppe-items/999')
      .send({ display_name: 'Safety Helmet' });

    expect(res.status).toBe(404);
  });

  it('should return 409 when changing to a duplicate item_key', async () => {
    prisma.ppeItem.findUnique
      .mockResolvedValueOnce(mockPpeItem) // item exists
      .mockResolvedValueOnce({ id: 2, itemKey: 'safety_vest' }); // duplicate found

    const res = await request(app)
      .put('/api/ppe-items/1')
      .send({ item_key: 'safety_vest' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/item_key already exists/i);
  });
});

// ─── DELETE /api/ppe-items/:id ───────────────────────────
describe('DELETE /api/ppe-items/:id', () => {
  it('should delete a PPE item', async () => {
    prisma.ppeItem.findUnique.mockResolvedValue(mockPpeItem);
    prisma.rolePpeRequirement.count.mockResolvedValue(0); // not in use
    prisma.ppeItem.delete.mockResolvedValue(mockPpeItem);

    const res = await request(app).delete('/api/ppe-items/1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/deleted/i);
    expect(res.body.data.id).toBe(1);
  });

  it('should return 404 when PPE item not found', async () => {
    prisma.ppeItem.findUnique.mockResolvedValue(null);

    const res = await request(app).delete('/api/ppe-items/999');

    expect(res.status).toBe(404);
  });

  it('should return 409 when PPE item is assigned to roles', async () => {
    prisma.ppeItem.findUnique.mockResolvedValue(mockPpeItem);
    prisma.rolePpeRequirement.count.mockResolvedValue(3); // in use by 3 roles

    const res = await request(app).delete('/api/ppe-items/1');

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/Cannot delete/i);
    expect(res.body.error.message).toMatch(/3 role/i);
  });
});

// ─── Error Propagation (catch blocks) ────────────────────
describe('Error propagation', () => {
  it('GET /api/ppe-items should return 500 when Prisma throws', async () => {
    prisma.ppeItem.findMany.mockRejectedValue(new Error('DB error'));

    const res = await request(app).get('/api/ppe-items');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/ppe-items/:id should return 500 when Prisma throws', async () => {
    prisma.ppeItem.findUnique.mockRejectedValue(new Error('DB error'));

    const res = await request(app).get('/api/ppe-items/1');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/ppe-items should return 500 when Prisma throws', async () => {
    prisma.ppeItem.findUnique.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/ppe-items')
      .send({ item_key: 'test', display_name: 'Test' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('PUT /api/ppe-items/:id should return 500 when Prisma throws', async () => {
    prisma.ppeItem.findUnique.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .put('/api/ppe-items/1')
      .send({ display_name: 'Updated' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('DELETE /api/ppe-items/:id should return 500 when Prisma throws', async () => {
    prisma.ppeItem.findUnique.mockRejectedValue(new Error('DB error'));

    const res = await request(app).delete('/api/ppe-items/1');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

