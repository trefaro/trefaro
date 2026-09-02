import { Module } from '@nestjs/common';
import { ImageFileService } from './image-file.service';
import { PasswordHasher } from './password-hasher.service';

/**
 * The pieces of the business layer that more than one module needs (F100).
 *
 * Only providers live here — {@link PasswordHasher}, which every account of
 * this instance is hashed with, and {@link ImageFileService}, which every
 * stored image that gets served goes through. The rest of `business/common/` is
 * functions, types and one pipe, which need no injector and are imported
 * directly.
 *
 * Not global on purpose: a module that hashes passwords or keeps images says so
 * in its imports.
 */
@Module({
  providers: [PasswordHasher, ImageFileService],
  exports: [PasswordHasher, ImageFileService],
})
export class CommonModule {}
