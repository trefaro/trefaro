import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CoreModuleRegistryService } from './core-module-registry.service';

const CORE_MODULE_KEY_METADATA = 'trefaro:coreModuleKey';

/**
 * Marks a controller as belonging to an optional core module (FR 1.5).
 *
 * Carried together with {@link CoreModuleEnabledGuard}; without it the guard
 * cannot tell which flag applies and denies the request.
 */
export const CoreModuleController = (moduleKey: string): ClassDecorator =>
  SetMetadata(CORE_MODULE_KEY_METADATA, moduleKey);

/**
 * Blocks requests to core modules the organization has switched off.
 *
 * The same answer a disabled plug-in gives, and for the same reasons: 404, not
 * 403, because a module that is off should look absent rather than forbidden —
 * and because that is what the clients already see, since a disabled module is
 * missing from `/api/config` entirely. Until AP 11 a switched-off core module
 * only disappeared from that payload while its endpoints kept answering, which
 * made the switch a suggestion to the clients rather than a decision (F53).
 *
 * Applied per controller rather than by URL prefix — unlike the administrative
 * guard (E16), which protects everything under `/api/admin` precisely because a
 * forgotten decorator there would be an open endpoint. Here a forgotten
 * decorator means a module that keeps answering when it is off: worth fixing, but
 * not a hole, and there is no prefix that could carry it, because an optional
 * module has endpoints on both sides of the API.
 */
@Injectable()
export class CoreModuleEnabledGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly modules: CoreModuleRegistryService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const moduleKey = this.reflector.getAllAndOverride<string | undefined>(
      CORE_MODULE_KEY_METADATA,
      [context.getHandler(), context.getClass()],
    );

    // An unmarked handler behind this guard is a wiring mistake. Denying is the
    // safe reading: better a module that answers nothing than one that ignores
    // its flag.
    if (!moduleKey || !this.modules.isEnabled(moduleKey)) {
      throw new NotFoundException();
    }
    return true;
  }
}
