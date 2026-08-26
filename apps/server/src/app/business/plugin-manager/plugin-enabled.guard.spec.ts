import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PluginEnabledGuard } from './plugin-enabled.guard';
import type { PluginRegistryService } from './plugin-registry.service';

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
    const registry = {
      isEnabled: (key: string) => enabledKeys.includes(key),
    } as PluginRegistryService;
    return new PluginEnabledGuard(reflector, registry);
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
});
