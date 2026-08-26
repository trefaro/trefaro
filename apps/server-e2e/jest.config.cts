export default {
  displayName: 'server-e2e',
  preset: '../../jest.preset.js',
  globalSetup: '<rootDir>/src/support/global-setup.ts',
  // No global teardown: Nx owns the server process, and killing the port here
  // would pull it out from under the client e2e suites in the same run.
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/server-e2e',
};
