import { ApiProperty } from '@nestjs/swagger';
import type {
  ModuleFamily,
  ModuleSummary,
  ModuleToggle,
  PluginMountPoint,
} from '@trefaro/shared-models';
import { IsBoolean } from 'class-validator';

/**
 * One switchable module as the administration reads it (FR 1.5).
 *
 * Response only — nothing here is written except the flag, which has a body of
 * its own. The plug-in fields are nullable rather than absent so the list is one
 * shape for both families (see `ModuleSummary`).
 */
export class ModuleSummaryDto implements ModuleSummary {
  @ApiProperty({
    example: 'media-links',
    description:
      'Stable module key, also the `module_config.module_key` and the key the ' +
      'clients read from `/api/config`.',
  })
  key!: string;

  @ApiProperty({
    enum: ['core', 'plugin'],
    description:
      'A core module ships inside the application; a plug-in additionally ' +
      'brings a web component bundle the clients load.',
  })
  family!: ModuleFamily;

  @ApiProperty({
    example: 'modules.mediaLinks',
    description:
      'Translation key for the name. The clients resolve it; until the ' +
      'catalogue exists they humanise the key instead.',
  })
  titleKey!: string;

  @ApiProperty({
    description:
      'Whether this instance answers for the module right now. Read from the ' +
      'same state the guards use, so this cannot disagree with the API (F53).',
  })
  enabled!: boolean;

  @ApiProperty({ description: 'What a fresh instance starts with.' })
  enabledByDefault!: boolean;

  @ApiProperty({
    isArray: true,
    type: String,
    example: ['profiles'],
    description:
      'Module keys that have to be on before this one can be (E42). Empty ' +
      'for almost everything. Switching this module on while one of them is ' +
      'off answers 409 and names it; switching one of them off while this ' +
      'module is on answers 409 as well. Nothing is ever resolved silently.',
  })
  requires!: readonly string[];

  @ApiProperty({
    nullable: true,
    example: '0.1.0',
    description: 'The plug-in’s own version; `null` for a core module.',
  })
  version!: string | null;

  @ApiProperty({
    nullable: true,
    example: '/api/plugins/room-planning/main.js',
    description:
      'What the clients load; `null` for a core module and for a plug-in that ' +
      'only adds server-side behaviour.',
  })
  bundleUrl!: string | null;

  @ApiProperty({
    isArray: true,
    enum: ['navigation', 'event-detail'],
    description: 'Where the web component mounts; empty for a core module.',
  })
  mountPoints!: readonly PluginMountPoint[];
}

/** The one thing this endpoint writes. */
export class ToggleModuleDto implements ModuleToggle {
  @ApiProperty({
    description:
      'Takes effect immediately: the server re-reads its flags as part of ' +
      'this request rather than on its next scheduled read (F6). A client ' +
      'learns of it on its next load (E20).',
  })
  @IsBoolean()
  enabled!: boolean;
}
