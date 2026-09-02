import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { LogoImageService } from './logo-image.service';

/**
 * The bytes of the per-series and per-event logos (FR 2.1, FR 3.1).
 *
 * Below `EventSeriesModule` and `EventsModule` rather than above them, and that
 * direction is the whole design: this module knows nothing about series or
 * events, so the two that do can import it without a cycle and each keep its own
 * rule about which rows exist and who may change them.
 *
 * It depends on one port and one shared service: `LOGO_PATHS_REPOSITORY` comes
 * from the global data access module, and `ImageFileService` — the checks, the
 * write and the read that every served image shares — comes from
 * `CommonModule`, which is why that is the one import here.
 */
@Module({
  imports: [CommonModule],
  providers: [LogoImageService],
  exports: [LogoImageService],
})
export class LogoFilesModule {}
