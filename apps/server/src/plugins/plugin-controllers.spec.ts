import type { Type } from '@nestjs/common';
import {
  GUARDS_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import {
  PluginEnabledGuard,
  declaredPluginKey,
  type ServerPlugin,
} from '../app/business/plugin-api';
import { CURATED_PLUGINS } from './index';

/**
 * What every plug-in controller in this image has to be true of (E57).
 *
 * The contract test the plan of phase 4 asks for, and the reason it exists is
 * the shape of the risk: moderation added routes a participant writes to and
 * routes an organizer decides on, and each plug-in declares its own addresses.
 * A plug-in's **access level comes from its path** — `admin/plugins/<key>/…`,
 * `participant/plugins/<key>/…`, `user/plugins/<key>/…` — because the two host
 * guards are global and keyed on the declared path (E16, E33), so a forgotten
 * `@UseGuards` cannot open an endpoint. What a plug-in *can* forget is the two
 * things that are its own: the key its controller declares, and the switch
 * guard. Both are checked here, over every controller of every mounted
 * plug-in — so a plug-in written in AP 4, AP 7 or AP 9 cannot ship without
 * them.
 *
 * It reads the descriptors rather than booting Nest: what is under test is the
 * declaration, and a test that needed a running application would be a test
 * nobody runs while writing a controller.
 */

/** The controllers a plug-in's module contributes, whichever form it takes. */
function controllersOf(plugin: ServerPlugin): readonly Type<unknown>[] {
  const module = plugin.module;
  const declared =
    typeof module === 'function'
      ? Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, module)
      : module.controllers;
  return (declared ?? []) as readonly Type<unknown>[];
}

/** The path a controller declared, without a leading slash. */
function pathOf(controller: Type<unknown>): string {
  const declared = Reflect.getMetadata(PATH_METADATA, controller) as
    string | undefined;
  return (declared ?? '').replace(/^\/+/, '');
}

/** The guards a controller declared with `@UseGuards`. */
function guardsOf(controller: Type<unknown>): readonly unknown[] {
  return (
    (Reflect.getMetadata(GUARDS_METADATA, controller) as
      unknown[] | undefined) ?? []
  );
}

describe('every controller of every mounted plug-in', () => {
  /** One row per controller, so a failure names the file that is wrong. */
  const controllers = CURATED_PLUGINS.flatMap((plugin) =>
    controllersOf(plugin).map((controller) => ({
      plugin: plugin.key,
      controller,
      name: controller.name,
    })),
  );

  it('exists at all — a plug-in with an API declares controllers', () => {
    // Guards the test itself: if `controllersOf` stopped finding anything, every
    // assertion below would pass over an empty list.
    expect(controllers.length).toBeGreaterThanOrEqual(3);
  });

  it('takes its access level from a path with its own key in it', () => {
    for (const { plugin, controller, name } of controllers) {
      const path = pathOf(controller);
      expect({ name, path }).toEqual({
        name,
        path: expect.stringMatching(
          new RegExp(`^(admin|participant|user)/plugins/${plugin}(/|$)`),
        ),
      });
    }
  });

  it('declares the plug-in key the switch guard reads', () => {
    for (const { plugin, controller, name } of controllers) {
      // Without `@PluginController` the guard cannot tell which flag applies —
      // and denies, so the plug-in would answer 404 while switched on.
      expect({ name, key: declaredPluginKey(controller) }).toEqual({
        name,
        key: plugin,
      });
    }
  });

  it('carries the switch guard, so a disabled plug-in answers 404', () => {
    for (const { controller, name } of controllers) {
      expect({
        name,
        guarded: guardsOf(controller).includes(PluginEnabledGuard),
      }).toEqual({
        name,
        guarded: true,
      });
    }
  });

  it('declares no session guard of its own (E57)', () => {
    for (const { controller, name } of controllers) {
      // A plug-in does not invent authentication and cannot withdraw one: the
      // session guards hang on the prefix. The switch guard is the only one a
      // plug-in controller declares — anything else here would be a plug-in
      // deciding its own access rules.
      expect({ name, guards: guardsOf(controller) }).toEqual({
        name,
        guards: [PluginEnabledGuard],
      });
    }
  });
});
