/**
 * Jest test setup and global configuration
 */

// Set longer timeout for integration tests
jest.setTimeout(30000);

// Mock environment variables for tests
process.env.NODE_ENV = 'test';

// Global test utilities
global.testTimeout = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Clean up after all tests
afterAll(async () => {
  // Add any cleanup logic here
});
