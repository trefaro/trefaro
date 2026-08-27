import { Module } from '@nestjs/common';
import { AdminAttachmentsController } from './admin-attachments.controller';
import { AttachmentsService } from './attachments.service';

/**
 * Stored files (E9, F12) — one module, because more than one thing owns them.
 *
 * The registration module puts files here, the participant overview reads their
 * metadata, and the events and series modules ask for them to be purged before
 * they delete rows that would cascade. None of those need to know where bytes
 * live, which is what this module is for.
 *
 * It deliberately depends on nothing but its two ports: an attachment belongs to
 * a registration, but nothing here reads one — that keeps the module free of a
 * cycle with the module that creates them.
 */
@Module({
  controllers: [AdminAttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
