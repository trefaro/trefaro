import { Module } from '@nestjs/common';

/**
 * Event registration with double opt-in (UC 07).
 *
 * Second highest rated function in the survey (3.69). Mandatory name, first
 * name and e-mail plus a configurable field kit — text, choice, checkbox and
 * file upload for documents such as visas (FR 3.5, F12) — phase 1.
 * The confirmation link is signed and mailed through the organization's own
 * SMTP server; following it confirms the registration and invites the
 * visitor to create a profile.
 *
 * Structure only at this point: phase 0 validates the architecture, it does not
 * implement features. Controllers, services and repository ports arrive with
 * the phase named above.
 */
@Module({})
export class RegistrationModule {}
