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
});



