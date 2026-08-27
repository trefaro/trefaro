export default {
  displayName: 'server-e2e',
  preset: '../../jest.preset.js',
  globalSetup: '<rootDir>/src/support/global-setup.ts',
  // One worker: every suite here talks to the same server, the same database and
  // the same mailbox. Two workers clearing that mailbox is a race no test can
  // defend against, and a shared row count makes a parallel failure impossible
  // to read.
  maxWorkers: 1,
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
