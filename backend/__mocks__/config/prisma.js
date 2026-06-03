/**
 * Manual mock for the Prisma client.
 * Every model method is a jest.fn() so tests can set return values per-test.
 */

const mockPrisma = {
  worker: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  role: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  ppeItem: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  entryLog: {
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  detectionDetail: {
    groupBy: jest.fn(),
  },
  rolePpeRequirement: {
    deleteMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

// Helper to reset all mocks between tests
mockPrisma.__resetAllMocks = () => {
  Object.values(mockPrisma).forEach((model) => {
    if (typeof model === 'object' && model !== null) {
      Object.values(model).forEach((fn) => {
        if (typeof fn === 'function' && fn.mockReset) {
          fn.mockReset();
        }
      });
    }
  });
};

module.exports = mockPrisma;
