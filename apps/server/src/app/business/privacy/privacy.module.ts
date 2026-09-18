import { Module } from '@nestjs/common';
import { I18nModule } from '../i18n';
import { PrivacyService } from './privacy.service';

/**
 * Export and erasure — one module, because they are one subject (E65).
 *
 * It has **no controller of its own.** Both routes hang off `participant/me`,
 * which is the screen an account holder manages themselves from (F49), and the
 * deletion has to check a password — a check that may only happen where the
 * stored hash is allowed to be read, which is the accounts module. So
 * `ProfilesModule` imports this one and owns the two routes; this module owns
 * the work and the port.
 *
 * `I18nModule` for the archive's readme, which is the one piece of prose an
 * export contains and therefore the one piece that has to be in the language
 * its reader chose (E22). The port and the upload volume come from the global
 * data access module, like everywhere else.
 */
@Module({
  imports: [I18nModule],
  providers: [PrivacyService],
  exports: [PrivacyService],
})
export class PrivacyModule {}
