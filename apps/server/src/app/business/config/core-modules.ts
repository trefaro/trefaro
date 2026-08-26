/**
 * Core modules an organization may switch off (FR 1.5).
 *
 * Only genuinely optional functionality is listed. Event management itself —
 * login, configuration, event series, events, program, registration,
 * participants — is not toggleable: without it there is no application. This
 * follows NFR 1: offer only what the organization actually needs, but do not
 * let it disassemble the product.
 */
export interface CoreModuleDescriptor {
  readonly key: string;
  /** Translation key for the module's name in the administration. */
  readonly titleKey: string;
  readonly enabledByDefault: boolean;
}

export const CORE_MODULES: readonly CoreModuleDescriptor[] = [
  // Community features rank below event management in the survey (2.89 vs 3.39),
  // so an organization that only runs events starts without them.
  { key: 'chat', titleKey: 'modules.chat', enabledByDefault: false },
  { key: 'profiles', titleKey: 'modules.profiles', enabledByDefault: false },
  {
    key: 'profile-search',
    titleKey: 'modules.profileSearch',
    enabledByDefault: false,
  },
  { key: 'push', titleKey: 'modules.push', enabledByDefault: false },
  // Embedding external stream and media library links costs nothing when unused.
  {
    key: 'media-links',
    titleKey: 'modules.mediaLinks',
    enabledByDefault: true,
  },
  {
    key: 'newsletter',
    titleKey: 'modules.newsletter',
    enabledByDefault: false,
  },
];
