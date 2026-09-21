import { servesApiConsole } from './api-docs';

describe('the API console', () => {
  it('does not run on a production instance', () => {
    expect(servesApiConsole('production')).toBe(false);
  });

  it('runs while developing and while the suites run', () => {
    expect(servesApiConsole('development')).toBe(true);
    expect(servesApiConsole('test')).toBe(true);
  });
});
