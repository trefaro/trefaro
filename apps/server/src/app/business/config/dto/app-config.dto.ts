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

  @ApiProperty({
    nullable: true,
    type: String,
    example: '/api/media/branding/logo?v=1787790100000',
    description:
      'Public URL of the logo, or `null` while none is uploaded. It names the ' +
      'image rather than its stored path (E19); `?v=` changes whenever the ' +
      'configuration does, which is what lets the bytes be cached for a year.',
  })
  logoUrl!: string | null;

  @ApiProperty({
    example: "'Inter', system-ui, sans-serif",
    description:
      'The CSS stack, expanded from the stored catalogue key — the value the ' +
      'clients publish as `--trefaro-font-family`.',
  })
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
  @ApiProperty({ example: 'Democracy International e.V.' })
  organizationName!: string;

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

  @ApiProperty({
    example: 'https://events.example.org',
    description:
      'Where the participant client answers, so the organizer client can link ' +
      'to a public event page. From the environment, not the database.',
  })
  publicUserClientUrl!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '/api/media/branding/app-icon?v=1787790100000',
    description:
      'Public URL of the square app icon, or `null` while none is uploaded — ' +
      'then the icons shipped with the participant client apply, which are ' +
      'drawn as maskable (E26). Beside the theme rather than inside it: ' +
      'nothing in CSS refers to it.',
  })
  appIconUrl!: string | null;
}
