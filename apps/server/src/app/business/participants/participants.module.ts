import { Module } from '@nestjs/common';

/**
 * Participant overview for organizers (UC 05).
 *
 * The highest rated function of all (3.86): a table of registrations with
 * newsletter and profile status, details and registration statistics
 * (FR 3.3) — phase 1.
 * The e-mail address belongs directly in the table. That is the only change
 * the thesis' usability test asked for, so it is not an optional column.
 *
 * Structure only at this point: phase 0 validates the architecture, it does not
 * implement features. Controllers, services and repository ports arrive with
 * the phase named above.
 */
@Module({})
export class ParticipantsModule {}
