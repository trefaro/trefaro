import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CommonModule } from '../common/common.module';
import { AdminUserService } from './admin-user.service';
import { AdminGuard } from './admin.guard';
import { AdminsController } from './admins.controller';
import { AuthController } from './auth.controller';
import { SessionService } from './session.service';

/**
 * Administrative login and administrator accounts (UC 01, FR 1.2, FR 1.3).
 *
 * Registers {@link AdminGuard} globally rather than per controller: everything
 * under `/api/admin` needs a session, plug-in controllers included, and a
 * forgotten decorator would be an open endpoint (E16 of the phase 1 plan).
 *
 * The participant login (FR 4.2) is a different thing and lives beside this
 * module rather than inside it (E34) — an organizer and a participant are
 * separate identities, with separate tables and separate cookies. What the two
 * do share sits in `business/common/`: the password policy, the hasher, the
 * session token helpers, `AllowAnonymous` and the rate limit (F100).
 */
@Module({
  imports: [CommonModule],
  controllers: [AuthController, AdminsController],
  providers: [
    SessionService,
    AdminUserService,
    { provide: APP_GUARD, useClass: AdminGuard },
  ],
  exports: [SessionService, AdminUserService],
})
export class LoginModule {}
