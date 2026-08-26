import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AdminUserService } from './admin-user.service';
import { AdminGuard } from './admin.guard';
import { AdminsController } from './admins.controller';
import { AuthController } from './auth.controller';
import { PasswordHasher } from './password-hasher.service';
import { SessionService } from './session.service';

/**
 * Administrative login and administrator accounts (UC 01, FR 1.2, FR 1.3).
 *
 * Registers {@link AdminGuard} globally rather than per controller: everything
 * under `/api/admin` needs a session, plug-in controllers included, and a
 * forgotten decorator would be an open endpoint (E16 of the phase 1 plan).
 *
 * The user login (FR 4.2) is a different thing and arrives in phase 3; it will
 * live beside this module, not inside it — an organizer and a participant are
 * separate identities.
 */
@Module({
  controllers: [AuthController, AdminsController],
  providers: [
    PasswordHasher,
    SessionService,
    AdminUserService,
    { provide: APP_GUARD, useClass: AdminGuard },
  ],
  exports: [SessionService, AdminUserService],
})
export class LoginModule {}
