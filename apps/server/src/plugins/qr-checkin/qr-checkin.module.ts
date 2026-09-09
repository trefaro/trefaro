import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminCheckinController } from './api/admin-checkin.controller';
import { ParticipantTicketsController } from './api/participant-tickets.controller';
import { UserTicketController } from './api/user-ticket.controller';
import { TICKET_REPOSITORY } from './business/ports/ticket.repository';
import { QrCheckinService } from './business/qr-checkin.service';
import { TicketEntity } from './data-access/entities/ticket.entity';
import { TypeormTicketRepository } from './data-access/typeorm-ticket.repository';

/**
 * The QR check-in plug-in as one NestJS module.
 *
 * It wires its own three parts together — API controllers, business service and
 * data access repository — and binds its own port to its own implementation.
 * The core learns nothing about tickets beyond what the plug-in descriptor
 * declares.
 *
 * **Three controllers for three access levels** (E57), which is one more than
 * any other plug-in of this phase and the reason the check-in is worth reading
 * as an example: the ticket behind a mailed link is anonymous and authorized by
 * a signature (E11, E54), the list of one's own tickets needs a session (F148),
 * and the door needs an organizer.
 *
 * What it does *not* import is a core module. The one thing it needs from the
 * host — resolving a self-service claim and reading who is expected at an event
 * — arrives through a token from `plugin-api`, provided by the global plug-in
 * host module.
 */
@Module({
  imports: [TypeOrmModule.forFeature([TicketEntity])],
  controllers: [
    UserTicketController,
    ParticipantTicketsController,
    AdminCheckinController,
  ],
  providers: [
    QrCheckinService,
    TypeormTicketRepository,
    { provide: TICKET_REPOSITORY, useExisting: TypeormTicketRepository },
  ],
})
export class QrCheckinModule {}
