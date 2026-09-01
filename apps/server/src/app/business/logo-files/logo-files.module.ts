import { Module } from '@nestjs/common';
import { LogoImageService } from './logo-image.service';

/**
 * The bytes of the per-series and per-event logos (FR 2.1, FR 3.1).
 *
 * Below `EventSeriesModule` and `EventsModule` rather than above them, and that
 * direction is the whole design: this module knows nothing about series or
 * events, so the two that do can import it without a cycle and each keep its own
 * rule about which rows exist and who may change them.
 *
 * It depends on nothing but its two ports, like `AttachmentsModule` — `FILE_STORE`
 * and `LOGO_PATHS_REPOSITORY` both come from the global data access module, and
 * the signature helpers it borrows from the attachments module are plain
 * functions with no injection behind them.
 */
@Module({
  providers: [LogoImageService],
  exports: [LogoImageService],
})
export class LogoFilesModule {}
