import { Inject, Injectable } from '@nestjs/common';
import type { EventDashboard } from '@trefaro/shared-models';
import { DASHBOARD_LATEST_REGISTRATIONS } from '@trefaro/shared-models';
import { EventSeriesService } from '../event-series';
import { EventsService } from '../events';
import {
  PROGRAM_TALLY,
  type ProgramTally,
} from '../program/ports/program-tally';
import {
  ParticipantsService,
  RegistrationFieldsService,
} from '../registration';

/**
 * The dashboard of one event (FR 3.8, UC 05).
 *
 * A composition, not a fifth owner of anything: every number here comes from the
 * module that owns the data, which is what keeps the dashboard from becoming a
 * second, subtly different definition of "registered".
 *
 * Three decisions are worth naming, because each one is a choice this service
 * could have got wrong in a way nobody would notice until the numbers were on
 * screen:
 *
 * 1. **The event is resolved first.** An unknown id is a 404 rather than a
 *    dashboard full of zeros — the same rule every list in this application
 *    follows, and for the same reason: zeros look like an answer. Each service
 *    asked below resolves it again; that is three primary-key reads and the
 *    price of every module keeping its own visibility rule instead of trusting
 *    a caller's word for it.
 * 2. **Registrations come from the overview, not from a second query.** One page
 *    of the participant table already carries the unfiltered counts *and* the
 *    newest rows (FR 3.3), so asking it for five rows answers both tiles at
 *    once. A separate count here would be a second place where "how many are
 *    registered" is defined.
 * 3. **The programme is counted, the form is read.** Sessions carry two
 *    kilobytes of abstract each and there can be three hundred of them, so they
 *    have a narrow tally port; the form's field definitions are capped at thirty
 *    tiny rows that the form editor reads anyway, so counting them here is
 *    honest rather than wasteful. Where that line runs is written down on
 *    {@link ProgramTally}.
 */
@Injectable()
export class EventDashboardService {
  constructor(
    private readonly events: EventsService,
    // For the public address participants are given: it is nested, because
    // slugs are unique per parent rather than globally (E7, F28).
    private readonly series: EventSeriesService,
    private readonly participants: ParticipantsService,
    private readonly fields: RegistrationFieldsService,
    // Counts only. The dashboard says how full the programme is, and never
    // needs a session — let alone who signed up for one.
    @Inject(PROGRAM_TALLY)
    private readonly program: ProgramTally,
  ) {}

  async forEvent(eventId: string): Promise<EventDashboard> {
    const event = await this.events.getForOrganizer(eventId);

    const [series, page, program, fields] = await Promise.all([
      this.series.getForOrganizer(event.seriesId),
      // Newest first is the default of the overview, which is what "latest"
      // means here — the arrival an organizer has not seen yet.
      this.participants.list(eventId, {
        pageSize: DASHBOARD_LATEST_REGISTRATIONS,
      }),
      this.program.countForEvent(eventId),
      this.fields.listForOrganizer(eventId),
    ]);

    return {
      event,
      seriesSlug: series.slug,
      registrations: page.counts,
      latestRegistrations: page.rows,
      program,
      form: {
        questions: fields.length,
        required: fields.filter((field) => field.required).length,
      },
    };
  }
}
