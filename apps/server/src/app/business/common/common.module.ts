import { Module } from '@nestjs/common';
import { PasswordHasher } from './password-hasher.service';

/**
 * The pieces of the business layer that more than one module needs (F100).
 *
 * Only providers live here — {@link PasswordHasher} is the whole list so far.
 * The rest of `business/common/` is functions, types and one pipe, which need no
 * injector and are imported directly.
 *
 * Not global on purpose: a module that hashes passwords says so in its imports.
 */
@Module({
  providers: [PasswordHasher],
  exports: [PasswordHasher],
})
export class CommonModule {}
