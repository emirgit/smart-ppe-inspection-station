module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/tests/setupAuthMock.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/generated/**',
    '!src/config/prisma.js',
    '!src/server.js',
    '!src/docs/**',
  ],
  moduleNameMapper: {
    // Redirect prisma imports to our manual mock
    '^../config/prisma$': '<rootDir>/src/__mocks__/config/prisma',
    '^../../config/prisma$': '<rootDir>/src/__mocks__/config/prisma',
    // Redirect storage service to our manual mock (prevents real R2/S3 client init)
    '^../services/storage\\.service$': '<rootDir>/src/__mocks__/services/storage.service',
    '^../../services/storage\\.service$': '<rootDir>/src/__mocks__/services/storage.service',
  },
};
