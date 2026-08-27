import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ContactOptOutResult,
  ContactQuery,
  Invitation,
  InvitationCounts,
  InvitationInput,
  InvitationPage,
  InvitationQuery,
  SeriesContactPage,
} from '@trefaro/shared-models';
import {
  DEFAULT_INVITATION_PAGE_SIZE,
  MAX_INVITATION_PAGE_SIZE,
  MAX_INVITATION_RECIPIENTS,
  invitationState,
} from '@trefaro/shared-models';
import { EventSeriesService } from '../event-series';
import { EventsService } from '../events';
import { ContactsService } from '../registration';
import { TokenSigner } from '../security';
import { InvitationSenderService } from './invitation-sender.service';
import {
  INVITATION_REPOSITORY,
  type InvitationRecord,
  type InvitationRepository,
} from './ports/invitation.repository';

/** Zero for an invitation whose recipients have all been erased since. */
const NO_COUNTS: InvitationCounts = { recipients: 0, sent: 0, failed: 0 };

/**
 * Inviting former participants to the next event of a series (UC 03, FR 2.4).
 *
 * The one feature of phase 1 that writes to people who did not just ask for
 * something, which is why almost everything here is a restriction:
 *
 * - **The audience is not the organizer's to compose.** It is drawn from
 *   confirmed registrations of this very series, minus everyone who objected
 *   (E15) — {@link ContactsService} owns that filter, and a selection names
 *   registrations rather than addresses (F55). There is no field anywhere in
 *   this module that takes an e-mail address.
 * - **Every mail carries the way out.** The objection link is written by the
 *   template, not by the organizer, so it cannot be left out of a message (F58).
 * - **Sending is not the request.** Two hundred recipients answer `202` and are
 *   worked through afterwards (F56); {@link InvitationSenderService} does that.
 *
 * What this service does *not* do is decide who may read any of it: everything
 * except the objection sits under `/api/admin`, which the prefix guard covers
 * (E16).
 */
@Injectable()
export class InvitationsService {
  constructor(
    @Inject(INVITATION_REPOSITORY)
    private readonly invitations: InvitationRepository,
    private readonly series: EventSeriesService,
    private readonly events: EventsService,
    // Who may be written to, and the only place `contact_opt_out` is written.
    private readonly contacts: ContactsService,
    private readonly sender: InvitationSenderService,
    private readonly tokens: TokenSigner,
  ) {}

  /**
   * The addresses this series may invite (FR 2.4).
   *
   * Resolving the series first turns an unknown id into a 404 rather than an
   * empty list, which an organizer would read as "nobody has ever registered".
   */
  async audience(
    seriesId: string,
    query: ContactQuery,
  ): Promise<SeriesContactPage> {
    await this.series.getForOrganizer(seriesId);
    return this.contacts.list(seriesId, query);
  }

  /** What has been sent for this series, newest first, with its progress. */
  async list(
    seriesId: string,
    query: InvitationQuery,
  ): Promise<InvitationPage> {
    await this.series.getForOrganizer(seriesId);

    const page = positiveInteger(query.page, 1);
    const pageSize = clamp(
      positiveInteger(query.pageSize, DEFAULT_INVITATION_PAGE_SIZE),
      1,
      MAX_INVITATION_PAGE_SIZE,
    );

    const slice = await this.invitations.findBySeries(
      seriesId,
      (page - 1) * pageSize,
      pageSize,
    );
    // One query for every count on the page, not one per row.
    const counts = await this.invitations.countsFor(
      slice.rows.map((row) => row.id),
    );

    return {
      rows: slice.rows.map((row) =>
        toInvitation(row, counts.get(row.id) ?? NO_COUNTS),
      ),
      total: slice.total,
      page,
      pageSize,
    };
  }

  /** One invitation — what the organizer's page polls while it is being sent. */
  async get(id: string): Promise<Invitation> {
    const record = await this.invitations.findById(id);
    if (!record) throw new NotFoundException('No invitation with that id');

    const counts = await this.invitations.countsFor([id]);
    return toInvitation(record, counts.get(id) ?? NO_COUNTS);
  }

  /**
   * Writes the invitation and its recipients, then hands it to the sender.
   *
   * Everything that can be refused is refused before a single mail goes out —
   * an unknown event, an address that may no longer be written to, an empty
   * subject. After this returns, the send is under way and cannot be recalled,
   * which is exactly why the order matters.
   */
  async create(seriesId: string, input: InvitationInput): Promise<Invitation> {
    await this.series.getForOrganizer(seriesId);

    const subject = text(input.subject, 'subject');
    const body = text(input.body, 'message');
    const eventId = await this.eventOfSeries(seriesId, input.eventId ?? null);

    if (input.recipients.length > MAX_INVITATION_RECIPIENTS) {
      throw new BadRequestException(
        `One invitation may name at most ${MAX_INVITATION_RECIPIENTS} addresses.`,
      );
    }

    // The gate: every id is looked up again through the audience filter, so
    // nothing that is not in the list can be written to (E15, F55).
    const recipients = await this.contacts.selection(
      seriesId,
      input.recipients,
    );

    const record = await this.invitations.create({
      seriesId,
      eventId,
      subject,
      body,
      registrationIds: recipients.map((contact) => contact.registrationId),
    });

    // Not awaited: the request answers with the invitation, the mails follow
    // (F56).
    this.sender.start(record.id);

    return toInvitation(record, {
      recipients: recipients.length,
      sent: 0,
      failed: 0,
    });
  }

  /**
   * Records an objection from the link in an invitation (E15, F58).
   *
   * Public, and the one operation in this module that is: the person clicking
   * has no account and must not need one to be left alone. What the token
   * authorizes is exactly this — {@link TokenSigner} checks the purpose, so an
   * invitation link cannot be replayed as a self-service link or the other way
   * round.
   */
  async optOut(token: string): Promise<ContactOptOutResult> {
    const registrationId = this.tokens.verify('invitation-opt-out', token);
    if (!registrationId) {
      throw new BadRequestException(
        'This link is not valid any more. Please reply to the invitation and ' +
          'ask to be removed — a person will read it.',
      );
    }
    return this.contacts.optOut(registrationId);
  }

  /**
   * The event an invitation invites to, if it names one.
   *
   * Checked against the series rather than trusted: an invitation to an event of
   * a *different* series would put a link in the mail that has nothing to do
   * with why these people are being written to — which is the one thing E15
   * bases the whole feature on.
   */
  private async eventOfSeries(
    seriesId: string,
    eventId: string | null,
  ): Promise<string | null> {
    if (!eventId) return null;

    const event = await this.events.getForOrganizer(eventId);
    if (event.seriesId !== seriesId) {
      throw new BadRequestException(
        'That event belongs to a different event series.',
      );
    }
    return event.id;
  }
}

function toInvitation(
  record: InvitationRecord,
  counts: InvitationCounts,
): Invitation {
  return {
    id: record.id,
    seriesId: record.seriesId,
    eventId: record.eventId,
    subject: record.subject,
    body: record.body,
    // Derived, never stored: the counts are the truth about a send (F56).
    state: invitationState(counts),
    recipients: counts.recipients,
    sent: counts.sent,
    failed: counts.failed,
    createdAt: record.createdAt.toISOString(),
    finishedAt: record.finishedAt?.toISOString() ?? null,
  };
}

/** Trimmed and not empty. The maximum length is the DTO's business. */
function text(value: string, what: string): string {
  const trimmed = (value ?? '').trim();
  if (trimmed.length === 0) {
    throw new BadRequestException(`An invitation needs a ${what}.`);
  }
  return trimmed;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && (value as number) > 0
    ? (value as number)
    : fallback;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}
