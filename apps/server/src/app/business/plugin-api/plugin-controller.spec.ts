import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PluginController,
  PluginEnabledGuard,
  declaredPluginKey,
  type PluginEnabled,
} from './plugin-controller';

function contextFor(handler: () => void, controller: object): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

describe('PluginEnabledGuard', () => {
  const handler = () => undefined;
  class ForumController {}

  function guardFor(
    metadata: string | undefined,
    enabledKeys: readonly string[],
  ): PluginEnabledGuard {
    const reflector = {
      getAllAndOverride: () => metadata,
    } as unknown as Reflector;
    const plugins: PluginEnabled = {
      isEnabled: (key: string) => enabledKeys.includes(key),
    };
    return new PluginEnabledGuard(reflector, plugins);
  }

  it('lets a request through when the plug-in is enabled', () => {
    const guard = guardFor('forum', ['forum']);

    expect(guard.canActivate(contextFor(handler, ForumController))).toBe(true);
  });

  it('answers 404 for a disabled plug-in so it looks absent, not forbidden', () => {
    const guard = guardFor('forum', []);

    expect(() =>
      guard.canActivate(contextFor(handler, ForumController)),
    ).toThrow(NotFoundException);
  });

  it('denies an unmarked handler rather than defaulting to open', () => {
    const guard = guardFor(undefined, ['forum']);

    expect(() =>
      guard.canActivate(contextFor(handler, ForumController)),
    ).toThrow(NotFoundException);
  });

  it('reads back the key a controller declared, for the contract test', () => {
    // What `plugin-controllers.spec.ts` walks the mounted plug-ins with (E57).
    // A controller without the decorator answers `undefined` rather than
    // throwing, so the test can report *which* controller forgot it.
    @PluginController('forum')
    class Declared {}
    class Undeclared {}

    expect(declaredPluginKey(Declared)).toBe('forum');
    expect(declaredPluginKey(Undeclared)).toBeUndefined();
  });
});
