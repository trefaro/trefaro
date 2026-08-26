import { Module } from '@nestjs/common';

/**
 * Outgoing e-mail through the organization's own SMTP server (F8).
 *
 * Multilingual templates and signed double opt-in links — phase 1.
 * Also the channel for replying to interested people who have no account:
 * the organizer answers in the app, the visitor receives an e-mail (F11).
 * No newsletter sending in v1 — only opt-in management (FR 4.8).
 *
 * Structure only at this point: phase 0 validates the architecture, it does not
 * implement features. Controllers, services and repository ports arrive with
 * the phase named above.
 */
@Module({})
export class MailModule {}
