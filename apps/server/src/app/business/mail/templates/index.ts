import { germanMailTemplates } from './de';
import { englishMailTemplates } from './en';
import type { MailTemplates } from './types';

/**
 * Which language a mail goes out in.
 *
 * A registry rather than a switch, so phase 2 — where an organization maintains
 * its own languages — adds a file and one entry instead of touching the callers.
 * English is the fallback because every instance has it (NFR 4).
 */
const TEMPLATES: Readonly<Record<string, MailTemplates>> = {
  en: englishMailTemplates,
  de: germanMailTemplates,
};

export const FALLBACK_LOCALE = 'en';

/** Locales mail can currently be sent in — shown in the administration later. */
export const MAIL_TEMPLATE_LOCALES: readonly string[] = Object.keys(TEMPLATES);

/**
 * The best available set for a locale.
 *
 * Falls back along the tag: `de-AT` uses the German templates before it reaches
 * English. An organization that configures a regional locale should not silently
 * get English mail because of the region.
 */
export function mailTemplates(locale: string): MailTemplates {
  const tag = locale.trim().toLowerCase();
  const base = tag.split('-')[0];
  return TEMPLATES[tag] ?? TEMPLATES[base] ?? TEMPLATES[FALLBACK_LOCALE];
}

export { escapeHtml } from './html';
export type {
  ConfirmationMailContext,
  MailEvent,
  MailTemplates,
  RegistrationMailContext,
  RenderedMail,
} from './types';
