import type {
  AdmissionPage,
  AdmissionRow,
  CheckinResult,
  CheckinTicket,
  CheckinTicketPage,
} from '@trefaro/shared-models';
import {
  NotSignedInError,
  PluginRequestError,
} from '@trefaro/shared-plugin-kit';

/** What the host hands over under `plugins.qrCheckin.`, prefix stripped. */
export const STRINGS: Record<string, string> = {
  ticketTitle: 'Ihr Check-in-Code',
  ticketIntro: 'Zeigen Sie diesen Code am Eingang.',
  codeHint: 'Wenn der Code nicht gelesen wird, lesen Sie diese Zeichen vor.',
  checkedIn: 'Eingelassen',
  noTicket: 'Für diese Anmeldung gibt es keinen Check-in-Code.',
  signIn: 'Melden Sie sich an, um Ihren Check-in-Code zu sehen.',
  loading: 'Wird geladen …',
  error: 'Das hat nicht funktioniert.',
  doorTitle: 'Einlass',
  doorIntro: 'Den Code mit der Kamera scannen oder eintippen.',
  codeLabel: 'Check-in-Code',
  admit: 'Einlassen',
  startCamera: 'Kamera benutzen',
  stopCamera: 'Kamera ausschalten',
  scanning: 'Den Code vor die Kamera halten.',
  cameraFailed: 'Dieser Browser gibt keine Kamera her.',
  admitted: 'Gerade eingelassen',
  alreadyHere: 'Schon da seit',
  listTitle: 'Wer erwartet wird',
  emptyList: 'Für diese Veranstaltung hat sich noch niemand angemeldet.',
  nameColumn: 'Name',
  stateColumn: 'An der Tür',
  waiting: 'Noch nicht da',
  unknownCode: 'Kein Ticket trägt diesen Code.',
  more: 'Mehr anzeigen',
};

/** Twenty-six characters of Crockford's base32, like the real thing. */
export const CODE = 'K7QF3M2X9TVB4ND8RJ0HC5WGYP';

export function ticket(over: Partial<CheckinTicket> = {}): CheckinTicket {
  return {
    registrationId: 'registration-1',
    eventId: 'event-1',
    firstName: 'Amina',
    lastName: 'Okonkwo',
    code: CODE,
    issuedAt: '2027-06-14T06:00:00.000Z',
    checkedInAt: null,
    ...over,
  };
}

export function row(over: Partial<AdmissionRow> = {}): AdmissionRow {
  return {
    registrationId: 'registration-1',
    firstName: 'Amina',
    lastName: 'Okonkwo',
    code: CODE,
    checkedInAt: null,
    ...over,
  };
}

export function page(
  rows: readonly AdmissionRow[],
  over: Partial<AdmissionPage> = {},
): AdmissionPage {
  return { rows, total: rows.length, page: 1, pageSize: 25, ...over };
}

export function result(over: Partial<CheckinResult> = {}): CheckinResult {
  return {
    registrationId: 'registration-1',
    eventId: 'event-1',
    firstName: 'Amina',
    lastName: 'Okonkwo',
    checkedInAt: '2027-06-14T07:12:00.000Z',
    alreadyCheckedIn: false,
    ...over,
  };
}

/** The refusal the door gets for a code no ticket carries. */
export const unknownCode = (): PluginRequestError =>
  new PluginRequestError(404);

/** The refusal a session that has expired gets. */
export const noSession = (): NotSignedInError => new NotSignedInError();

/**
 * The plug-in's routes, answering what the test put in and recording what was
 * asked — no network, no host.
 */
export class FakeApi {
  /** What the link route answers, or the error it throws. */
  linkAnswer: CheckinTicket | Error = ticket();
  /** Pages of the session route, in the order they are asked for. */
  ticketPages: CheckinTicketPage[] = [];
  /** Pages of the admission list, in the order they are asked for. */
  admissionPages: AdmissionPage[] = [];
  /** What a scan answers, or the error it throws. */
  scanAnswer: CheckinResult | Error = result();

  readonly linkReads: string[] = [];
  readonly ticketReads: number[] = [];
  readonly admissionReads: { eventId: string; page: number }[] = [];
  readonly scans: string[] = [];

  ticketByLink(token: string): Promise<CheckinTicket> {
    this.linkReads.push(token);
    return answer(this.linkAnswer);
  }

  async ticketOf(registrationId: string): Promise<CheckinTicket | null> {
    // The real one walks the pages; the fake answers what the test laid out,
    // so a suite about the section is not a suite about paging.
    for (let index = 0; index < Math.max(1, this.ticketPages.length); index++) {
      this.ticketReads.push(index + 1);
      const found = this.ticketPages[index]?.rows.find(
        (one) => one.registrationId === registrationId,
      );
      if (found) return found;
    }
    return null;
  }

  admissions(eventId: string, page: number): Promise<AdmissionPage> {
    this.admissionReads.push({ eventId, page });
    const answer = this.admissionPages[page - 1];
    return answer
      ? Promise.resolve(answer)
      : Promise.reject(new PluginRequestError(500));
  }

  checkIn(code: string): Promise<CheckinResult> {
    this.scans.push(code);
    return answer(this.scanAnswer);
  }
}

function answer<T>(value: T | Error): Promise<T> {
  return value instanceof Error
    ? Promise.reject(value)
    : Promise.resolve(value);
}

/**
 * Lets the fetches a section starts finish, then redraws.
 *
 * A macrotask tick rather than `whenStable()`: without zone.js a fixture is
 * "stable" as soon as no change detection is pending, which says nothing about
 * a promise still in flight.
 */
export async function settle(fixture: {
  detectChanges(): void;
}): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

export const textOf = (fixture: { nativeElement: unknown }): string =>
  (fixture.nativeElement as HTMLElement).textContent ?? '';

/**
 * Settles until a sentence appears, or gives up after `turns`.
 *
 * For the one path of this bundle whose length is not a constant: switching the
 * camera on fetches the decoder as its own chunk first (it is a third of the
 * weight and the ticket half has no use for it), so how many turns of the queue
 * that takes is the module loader's business, not the test's.
 */
export async function settleUntil(
  fixture: { detectChanges(): void; nativeElement: unknown },
  sentence: string,
  turns = 20,
): Promise<void> {
  for (let turn = 0; turn < turns; turn++) {
    await settle(fixture);
    if (textOf(fixture).includes(sentence)) return;
  }
}

export const one = (
  fixture: { nativeElement: unknown },
  selector: string,
): HTMLElement | null =>
  (fixture.nativeElement as HTMLElement).querySelector(selector);

export const all = (
  fixture: { nativeElement: unknown },
  selector: string,
): HTMLElement[] =>
  Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(selector));

export const buttons = (
  fixture: { nativeElement: unknown },
  label: string,
): HTMLButtonElement[] =>
  Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
  ).filter((button) => button.textContent?.trim() === label);

/** Submits a form the way a click on its button would. */
export function submit(form: HTMLFormElement): void {
  form.dispatchEvent(new Event('submit', { cancelable: true }));
}
