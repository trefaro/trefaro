import { Module } from '@nestjs/common';

/**
 * Programme items and the schedule (UC 11).
 *
 * Programme planning with topic, description, speaker, room and schedule
 * (FR 3.7) and per-item sign-up (FR 3.10) — phase 1.
 * Sign-up counts feed the room planning plug-in's overbooking check against
 * room capacity.
 *
 * Structure only at this point: phase 0 validates the architecture, it does not
 * implement features. Controllers, services and repository ports arrive with
 * the phase named above.
 */
@Module({})
export class ProgramModule {}
