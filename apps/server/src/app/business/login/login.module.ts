import { Module } from '@nestjs/common';

/**
 * Authentication and administrative accounts (UC 01, UC 08).
 *
 * Admin login and admin account management (FR 1.2, FR 1.3) — phase 1.
 * Participant login (FR 4.2) — phase 3.
 * Argon2 password hashing and strict separation of organizer and
 * participant roles; sensitive participant data is reachable only after
 * login (NFR 7).
 *
 * Structure only at this point: phase 0 validates the architecture, it does not
 * implement features. Controllers, services and repository ports arrive with
 * the phase named above.
 */
@Module({})
export class LoginModule {}
