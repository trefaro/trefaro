import { NotFoundException } from '@nestjs/common';
import type {
  EventSeries,
  OrganizerEvent,
  ParticipantPage,
  RegistrationField,
} from '@trefaro/shared-models';
import { DASHBOARD_LATEST_REGISTRATIONS } from '@trefaro/shared-models';
import type { EventSeriesService } from '../event-series';
import type { EventsService } from '../events';
import type { ProgramTally } from '../program/ports/program-tally';
import type {
  ParticipantsService,
  RegistrationFieldsService,
} from '../registration';
import { EventDashboardService } from './event-dashboard.service';

/**
 * The event dashboard (FR 3.8) — a composition, and tested as one.
 *
 * What matters here is not arithmetic: every number comes from a module that
 * counts it and tests it itself. What this suite asserts is that the dashboard
 * passes the questions on unchanged — the right event, the newest rows, five of
 * them — and that an unknown event is a 404 rather than a screen of zeros.
 */
const EVENT: OrganizerEvent = {
  id: 'event-1',
  slug: 'kickoff',
  name: 'Kickoff in Cologne',
  description: 'The event the dashboard summarizes.',
  logoUrl: null,
  eventType: 'onsite',
  startsAt: '2099-06-14T06:00:00.000Z',
  endsAt: '2099-06-14T16:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  venueAddress: null,
  onlineUrl: null,
  languages: ['de'],
  seriesId: 'series-1',
  status: 'published',
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-02T09:00:00.000Z',
};

const SERIES = { id: 'series-1', slug: 'democracy-days' } as EventSeries;

const PAGE = {
  rows: [
    { id: 'registration-2', email: 'dieter@example.org' },
    { id: 'registration-1', email: 'amina@example.org' },
  ],
  total: 2,
  page: 1,
  pageSize: DASHBOARD_LATEST_REGISTRATIONS,
  counts: { total: 7, pending: 4, confirmed: 2, cancelled: 1 },
} as unknown as ParticipantPage;

const field = (required: boolean): RegistrationField =>
  ({ id: `field-${required}`, required }) as RegistrationField;

describe('EventDashboardService', () => {
  let events: { getForOrganizer: jest.Mock };
  let series: { getForOrganizer: jest.Mock };
  let participants: { list: jest.Mock };
  let fields: { listForOrganizer: jest.Mock };
  let program: jest.Mocked<ProgramTally>;
  let service: EventDashboardService;

  beforeEach(() => {
    events = { getForOrganizer: jest.fn(async () => EVENT) };
    series = { getForOrganizer: jest.fn(async () => SERIES) };
    participants = { list: jest.fn(async () => PAGE) };
    fields = {
      listForOrganizer: jest.fn(async () => [
        field(true),
        field(false),
        field(true),
      ]),
    };
    program = {
      countForEvent: jest.fn(async (_eventId: string) => ({
        items: 4,
        withSignup: 2,
        signups: 9,
      })),
    };

    service = new EventDashboardService(
      events as unknown as EventsService,
      series as unknown as EventSeriesService,
      participants as unknown as ParticipantsService,
      fields as unknown as RegistrationFieldsService,
      program,
    );
  });

  it('answers with the event, its series address and every tile', async () => {
    const dashboard = await service.forEvent(EVENT.id);

    expect(dashboard.event.name).toBe('Kickoff in Cologne');
    expect(dashboard.seriesSlug).toBe('democracy-days');
    expect(dashboard.registrations).toEqual({
      total: 7,
      pending: 4,
      confirmed: 2,
      cancelled: 1,
    });
    expect(dashboard.program).toEqual({ items: 4, withSignup: 2, signups: 9 });
    expect(dashboard.form).toEqual({ questions: 3, required: 2 });
  });

  it('reads the series of the event, not of the request', async () => {
    await service.forEvent(EVENT.id);

    // Through the event's own `seriesId`: a dashboard reached by a wrong series
    // in the URL must still show the address the event actually has (E7).
    expect(series.getForOrganizer).toHaveBeenCalledWith('series-1');
  });

  it('asks the participant overview for five rows, newest first', async () => {
    const dashboard = await service.forEvent(EVENT.id);

    // No sort is passed: newest first is the overview's default, and saying it
    // twice would be two places to change it (FR 3.3).
    expect(participants.list).toHaveBeenCalledWith(EVENT.id, {
      pageSize: DASHBOARD_LATEST_REGISTRATIONS,
    });
    expect(dashboard.latestRegistrations.map((row) => row.email)).toEqual([
      'dieter@example.org',
      'amina@example.org',
    ]);
  });

  it('counts the programme instead of reading it', async () => {
    await service.forEvent(EVENT.id);

    // The narrow port, not `ProgramService`: three hundred sessions with their
    // abstracts is a lot of bytes to move for three numbers.
    expect(program.countForEvent).toHaveBeenCalledWith(EVENT.id);
  });

  it('turns an unknown event into a 404 rather than a screen of zeros', async () => {
    events.getForOrganizer.mockRejectedValue(new NotFoundException('gone'));

    await expect(service.forEvent('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    // Nothing else was asked: a 404 must not be preceded by four queries for a
    // screen that will never be rendered.
    expect(participants.list).not.toHaveBeenCalled();
    expect(program.countForEvent).not.toHaveBeenCalled();
    expect(fields.listForOrganizer).not.toHaveBeenCalled();
  });
});
