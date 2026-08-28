import { Module } from '@nestjs/common';

/**
 * Participant profiles (UC 09).
 *
 * Profile creation during registration (FR 4.1) and profile management —
 * name, picture, password, language, field of activity and configurable
 * fields (FR 4.3) — phase 3.
 * Managing and cancelling one's own registrations (FR 4.7) lives here too.
 *
 * Structure only: the module exists so the composition root and the layer
 * boundaries are in place before there is anything to put in them.
 * Controllers, services and repository ports arrive with the phase named
 * above.
 */
@Module({})
export class ProfilesModule {}
