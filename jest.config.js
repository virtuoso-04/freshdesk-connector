/**
 * Jest configuration for ESM (ES Modules) project.
 *
 * We use --experimental-vm-modules to enable native ESM support in Jest,
 * along with jest.unstable_mockModule for mocking ES modules.
 */

export default {
  testEnvironment: "node",
  transform: {},                 // no transform needed — Node handles ESM natively
  testMatch: ["**/src/__tests__/**/*.test.js"],
};
