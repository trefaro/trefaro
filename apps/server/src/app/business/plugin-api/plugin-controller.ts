import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * How a plug-in declares its API to the host (E57).
 *
 * Part of the contract rather than of the plug-in manager since AP 2 of phase 4,
 * and the move was forced by the rule it belongs to: a plug-in imports from
 * `plugin-api` and from nowhere else inside the server — now enforced by the
 * linter — while every plug-in controller has to carry {@link PluginController}
 * and {@link PluginEnabledGuard}. Re-exporting them from here would have been a
 * cycle (the manager imports this contract), so the guard moved and the thing it
 * needs from the manager became a port: {@link PLUGIN_ENABLED}, bound by
 * `PluginManagerModule` to the registry that keeps the flags.
 *
 * A plug-in gets its access level from its **path**, not from a guard of its
 * own: `admin/plugins/<key>/…` is behind the administrative session,
 * `participant/plugins/<key>/…` behind a participant's, `user/plugins/<key>/…`
 * behind neither. Both of those guards are global and keyed on the declared
 * path (E16, E33), so a plug-in cannot forget one — and it has no way to
 * withdraw one either, which is the point.
 */
const PLUGIN_KEY_METADATA = 'trefaro:pluginKey';

/**
 * Marks a controller as belonging to a plug-in.
 *
 * Every plug-in controller carries this together with {@link PluginEnabledGuard};
 * without it the guard cannot tell which flag applies and denies the request.
 */
export const PluginController = (pluginKey: string): ClassDecorator =>
  SetMetadata(PLUGIN_KEY_METADATA, pluginKey);

/** The plug-in key a controller declared, or `undefined` if it declared none. */
export function declaredPluginKey(
  controller: abstract new (...args: never[]) => unknown,
): string | undefined {
  return Reflect.getMetadata(PLUGIN_KEY_METADATA, controller) as
    string | undefined;
}

/** Whether the organization has a plug-in switched on right now. */
export interface PluginEnabled {
  isEnabled(pluginKey: string): boolean;
}

/**
 * Injection token for {@link PluginEnabled}.
 *
 * The one thing this guard needs and the contract cannot answer for itself.
 * Bound by `PluginManagerModule`, which is where the cached flags live.
 */
export const PLUGIN_ENABLED = Symbol('TREFARO_PLUGIN_ENABLED');

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
    @Inject(PLUGIN_ENABLED) private readonly plugins: PluginEnabled,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const pluginKey = this.reflector.getAllAndOverride<string | undefined>(
      PLUGIN_KEY_METADATA,
      [context.getHandler(), context.getClass()],
    );

    // An unmarked handler behind this guard is a wiring mistake. Denying is the
    // safe reading: better a broken plug-in than one that ignores its flag.
    if (!pluginKey || !this.plugins.isEnabled(pluginKey)) {
      throw new NotFoundException();
    }
    return true;
  }
}
