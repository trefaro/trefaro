import { Module } from '@nestjs/common';

/**
 * Event series — the unit an organization plans in (UC 02, UC 03).
 *
 * Create and manage series with name, description and logo (FR 2.1, FR 2.2)
 * and list a series' upcoming and past events (FR 2.3) — phase 1.
 * Inviting former participants to a new event (FR 2.4) follows in phase 1
 * once registrations exist to draw the addresses from.
 *
 * Structure only at this point: phase 0 validates the architecture, it does not
 * implement features. Controllers, services and repository ports arrive with
 * the phase named above.
 */
@Module({})
export class EventSeriesModule {}
