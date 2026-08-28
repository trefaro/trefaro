import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../config';
import { LoginModule } from '../login';
import { SetupController } from './setup.controller';
import { SetupGuard } from './setup.guard';
import { SetupTokenService } from './setup-token.service';
import { SetupService } from './setup.service';

/**
 * First-run setup (FR 1.1) — the module that exists to stop existing.
 *
 * Above the two modules it writes through, for the reason F49 gives: a service
 * that composes belongs over its parts. Inside `LoginModule` it would have
 * closed a circle with the configuration, and either module would then own a
 * decision — "who may create the first administrator" — that is neither of
 * theirs.
 *
 * The import of `LoginModule` also fixes the order of the bootstrap hooks: Nest
 * initialises a module's dependencies first, so an instance with
 * `ADMIN_BOOTSTRAP_*` has its administrator before this module asks whether one
 * exists, and no setup token is issued for it.
 *
 * The guard is a provider rather than a global: unlike the administrative guard
 * (E16), this one protects two named handlers in one file, and nothing outside
 * them may ever be reachable without a session.
 */
@Module({
  imports: [LoginModule, ConfigurationModule],
  controllers: [SetupController],
  providers: [SetupService, SetupTokenService, SetupGuard],
})
export class SetupModule {}
