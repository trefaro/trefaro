import { Module } from '@nestjs/common';

/**
 * Events within a series (UC 04, UC 05, UC 10).
 *
 * Create and edit events including presence, online and hybrid types
 * (FR 3.1, FR 3.2, FR 3.9), the organizer dashboard (FR 3.8) and the
 * public landing page (FR 3.6) — phase 1.
 * Per-field content translations (FR 3.12) follow in phase 2, and push on
 * change (FR 3.15) in phase 3.
 * The start page and the event landing page stay reachable without a login;
 * everything about participants does not.
 *
 * Structure only at this point: phase 0 validates the architecture, it does not
 * implement features. Controllers, services and repository ports arrive with
 * the phase named above.
 */
@Module({})
export class EventsModule {}
