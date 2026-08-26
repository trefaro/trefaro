import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PluginRegistryService } from './plugin-registry.service';

const PLUGIN_KEY_METADATA = 'trefaro:pluginKey';

/**
 * Marks a controller as belonging to a plug-in.
 *
 * Every plug-in controller carries this together with {@link PluginEnabledGuard};
 * without it the guard cannot tell which flag applies and denies the request.
 */
export const PluginController = (pluginKey: string): ClassDecorator =>
  SetMetadata(PLUGIN_KEY_METADATA, pluginKey);

/**
 * Blocks requests to plug-ins the organization has switched off.
 *
 * Answers 404 rather than 403: a disabled plug-in should look absent, not
 * forbidden. It reveals less about the instance and matches what the clients
 * see, since a disabled plug-in is missing from `/api/config` entirely.
 */
@Injectable()
export class PluginEnabledGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly registry: PluginRegistryService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const pluginKey = this.reflector.getAllAndOverride<string | undefined>(
      PLUGIN_KEY_METADATA,
      [context.getHandler(), context.getClass()],
    );

    // An unmarked handler behind this guard is a wiring mistake. Denying is the
    // safe reading: better a broken plug-in than one that ignores its flag.
    if (!pluginKey || !this.registry.isEnabled(pluginKey)) {
      throw new NotFoundException();
    }
    return true;
  }
}
