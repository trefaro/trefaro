import { ApiProperty } from '@nestjs/swagger';
import type {
  AppConfig,
  PluginDescriptor,
  PluginMountPoint,
  Theme,
} from '@trefaro/shared-models';

/**
 * OpenAPI representations of the shared configuration contract.
 *
 * Each class `implements` the interface from `@trefaro/shared-models`, so the
 * compiler fails if the documented API and the type both clients compile
 * against ever drift apart. The interfaces alone cannot carry OpenAPI metadata,
 * because they do not exist at runtime.
 */

export class ThemeDto implements Theme {
  @ApiProperty({ example: '#1f6f5c' })
  primaryColor!: string;

  @ApiProperty({ example: '#e8a33d' })
  accentColor!: string;

  @ApiProperty({ nullable: true, type: String, example: '/api/media/logo.svg' })
  logoUrl!: string | null;

  @ApiProperty({ example: "'Inter', system-ui, sans-serif" })
  fontFamily!: string;
}

export class PluginDescriptorDto implements PluginDescriptor {
  @ApiProperty({ example: 'room-planning' })
  key!: string;

  @ApiProperty({ example: '1.0.0' })
  version!: string;

  @ApiProperty({ example: 'plugins.roomPlanning' })
  labelKey!: string;

  @ApiProperty({ example: 'trefaro-plugin-room-planning' })
  elementName!: string;

  @ApiProperty({ example: '/plugins/room-planning/bundle.js' })
  bundleUrl!: string;

  @ApiProperty({
    isArray: true,
    enum: ['navigation', 'event-detail'],
    example: ['event-detail'],
  })
  mountPoints!: readonly PluginMountPoint[];

  @ApiProperty({ nullable: true, type: String, example: 'meeting_room' })
  icon!: string | null;
}

export class AppConfigDto implements AppConfig {
  @ApiProperty({ type: ThemeDto })
  theme!: ThemeDto;

  @ApiProperty({ example: 'en' })
  defaultLocale!: string;

  @ApiProperty({ isArray: true, type: String, example: ['en', 'de'] })
  availableLocales!: readonly string[];

  @ApiProperty({ isArray: true, type: String, example: ['media-links'] })
  enabledModules!: readonly string[];

  @ApiProperty({ isArray: true, type: PluginDescriptorDto })
  plugins!: readonly PluginDescriptorDto[];

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'Base64url VAPID public key for Web Push, or null when the instance has no key pair configured.',
  })
  webPushPublicKey!: string | null;
}
