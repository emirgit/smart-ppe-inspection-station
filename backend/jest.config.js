module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
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
  },
};
