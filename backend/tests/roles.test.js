const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/__mocks__/config/prisma');

beforeEach(() => {
  prisma.__resetAllMocks();
});

// ─── Helper Fixtures ─────────────────────────────────────
const mockRole = { id: 1, roleName: 'Welder', description: 'Welding dept', createdAt: new Date() };

// ─── GET /api/roles ──────────────────────────────────────
describe('GET /api/roles', () => {
  it('should return all roles', async () => {
    prisma.role.findMany.mockResolvedValue([mockRole]);

    const res = await request(app).get('/api/roles');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: 1,
      role_name: 'Welder',
      description: 'Welding dept',
    });
  });
});

// ─── POST /api/roles ─────────────────────────────────────
describe('POST /api/roles', () => {
  it('should create a new role (201)', async () => {
    prisma.role.findUnique.mockResolvedValue(null); // no duplicate
    prisma.role.create.mockResolvedValue(mockRole);

    const res = await request(app)
      .post('/api/roles')
      .send({ role_name: 'Welder', description: 'Welding dept' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role_name).toBe('Welder');
  });

  it('should return 422 when role_name is missing', async () => {
    const res = await request(app)
      .post('/api/roles')
      .send({ description: 'No name provided' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/role_name.*required/i);
  });

  it('should return 409 when role_name already exists', async () => {
    prisma.role.findUnique.mockResolvedValue(mockRole); // duplicate found

    const res = await request(app)
      .post('/api/roles')
      .send({ role_name: 'Welder' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/already exists/i);
  });
});

// ─── GET /api/roles/:id/ppe ──────────────────────────────
describe('GET /api/roles/:id/ppe', () => {
  it('should return PPE requirements for a role', async () => {
    const roleWithPpe = {
      ...mockRole,
      rolePpeRequirements: [
        {
          ppeItem: {
            id: 1,
            itemKey: 'welding_mask',
            displayName: 'Welding Mask',
          },
        },
        {
          ppeItem: {
            id: 2,
            itemKey: 'gloves',
            displayName: 'Gloves',
          },
        },
      ],
    };
    prisma.role.findUnique.mockResolvedValue(roleWithPpe);

    const res = await request(app).get('/api/roles/1/ppe');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role_id).toBe(1);
    expect(res.body.data.role_name).toBe('Welder');
    expect(res.body.data.ppe_items).toHaveLength(2);
    expect(res.body.data.ppe_items[0].item_key).toBe('welding_mask');
  });

  it('should return 404 when role not found', async () => {
    prisma.role.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/roles/999/ppe');

    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/Role not found/i);
  });
});

// ─── PUT /api/roles/:id/ppe ──────────────────────────────
describe('PUT /api/roles/:id/ppe', () => {
  it('should update PPE requirements for a role', async () => {
    prisma.role.findUnique
      .mockResolvedValueOnce(mockRole) // verify role exists
      .mockResolvedValueOnce({
        ...mockRole,
        rolePpeRequirements: [
          {
            ppeItem: { id: 1, itemKey: 'hard_hat', displayName: 'Hard Hat' },
          },
        ],
      }); // fetch updated data
    prisma.$transaction.mockResolvedValue([]);

    const res = await request(app)
      .put('/api/roles/1/ppe')
      .send({ ppe_item_ids: [1] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ppe_items).toHaveLength(1);
  });

  it('should return 422 when ppe_item_ids is missing or not an array', async () => {
    const res = await request(app)
      .put('/api/roles/1/ppe')
      .send({ ppe_item_ids: 'not-an-array' });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/ppe_item_ids/i);
  });

  it('should return 422 when ppe_item_ids is not provided', async () => {
    const res = await request(app)
      .put('/api/roles/1/ppe')
      .send({});

    expect(res.status).toBe(422);
  });

  it('should return 404 when role not found', async () => {
    prisma.role.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/roles/999/ppe')
      .send({ ppe_item_ids: [1, 2] });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/Role not found/i);
  });
});

// ─── Error Propagation (catch blocks) ────────────────────
describe('Error propagation', () => {
  it('GET /api/roles should return 500 when Prisma throws', async () => {
    prisma.role.findMany.mockRejectedValue(new Error('DB error'));

    const res = await request(app).get('/api/roles');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/roles should return 500 when Prisma throws', async () => {
    prisma.role.findUnique.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/roles')
      .send({ role_name: 'TestRole' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/roles/:id/ppe should return 500 when Prisma throws', async () => {
    prisma.role.findUnique.mockRejectedValue(new Error('DB error'));

    const res = await request(app).get('/api/roles/1/ppe');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('PUT /api/roles/:id/ppe should return 500 when Prisma throws', async () => {
    prisma.role.findUnique.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .put('/api/roles/1/ppe')
      .send({ ppe_item_ids: [1] });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

