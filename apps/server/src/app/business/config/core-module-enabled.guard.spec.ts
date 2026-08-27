import { NotFoundException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  CoreModuleController,
  CoreModuleEnabledGuard,
} from './core-module-enabled.guard';
import type { CoreModuleRegistryService } from './core-module-registry.service';

@CoreModuleController('media-links')
class MediaLinksController {
  list(): void {
    /* nothing: only its metadata is under test */
  }
}

class UnmarkedController {
  list(): void {
    /* nothing */
  }
}

/** An execution context pointing at one controller class and handler. */
function contextFor(controller: new () => { list(): void }): ExecutionContext {
  return {
    getClass: () => controller,
    getHandler: () => controller.prototype.list,
  } as unknown as ExecutionContext;
}

const registryWith = (enabled: readonly string[]) =>
  ({
    isEnabled: (key: string) => enabled.includes(key),
  }) as unknown as CoreModuleRegistryService;

/**
 * The guard that makes a switched-off core module answer 404 (FR 1.5, F53).
 *
 * Before AP 11 a disabled core module only vanished from `/api/config` while its
 * endpoints kept answering — which made the switch a suggestion to the clients
 * rather than a decision. The answer is the same one a disabled plug-in gives,
 * for the same reason: 404 rather than 403, because a module that is off should
 * look absent rather than forbidden.
 */
describe('CoreModuleEnabledGuard', () => {
  const guard = (enabled: readonly string[]) =>
    new CoreModuleEnabledGuard(new Reflector(), registryWith(enabled));

  it('lets a request through while the module is enabled', () => {
    expect(
      guard(['media-links']).canActivate(contextFor(MediaLinksController)),
    ).toBe(true);
  });

  it('answers 404 while the module is switched off', () => {
    expect(() =>
      guard([]).canActivate(contextFor(MediaLinksController)),
    ).toThrow(NotFoundException);
  });

  it('answers 404 for a handler nobody marked', () => {
    // A wiring mistake, and denying is the safe reading: better a module that
    // answers nothing than one that ignores its flag.
    expect(() =>
      guard(['media-links']).canActivate(contextFor(UnmarkedController)),
    ).toThrow(NotFoundException);
  });
});
