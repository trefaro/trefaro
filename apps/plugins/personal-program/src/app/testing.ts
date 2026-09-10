import type { PersonalProgramItem } from '@trefaro/shared-models';
import { NotSignedInError } from '@trefaro/shared-plugin-kit';

/**
 * What the host hands over under `plugins.personalProgram.`, prefix stripped.
 *
 * Spelled as a literal rather than as a `Record`, so a test that asserts on
 * `STRINGS.remove` is checked against the keys the component actually asks for
 * — a typo in a test is otherwise a test that passes for the wrong reason.
 */
export const STRINGS = {
  title: 'Mein Programm',
  intro: 'Markieren Sie, was Sie vorhaben. Dieser Plan reserviert nichts.',
  loading: 'Wird geladen …',
  error: 'Das hat nicht funktioniert.',
  signIn: 'Melden Sie sich an.',
  emptyProgram: 'Diese Veranstaltung hat noch kein Programm.',
  emptyPlan: 'Noch nichts in Ihrem Plan.',
  add: 'In meinen Plan',
  remove: 'Herausnehmen',
  inPlan: 'In meinem Plan',
  signupNote: 'Anmeldung im Programm',
  limited: 'Begrenzte Plätze',
  onlyMine: 'Nur mein Plan',
  whole: 'Ganzes Programm',
} as const satisfies Record<string, string>;

export function item(
  over: Partial<PersonalProgramItem> = {},
): PersonalProgramItem {
  return {
    programItemId: 'plenary',
    title: 'Opening plenary',
    startsAt: '2027-06-14T07:00:00.000Z',
    endsAt: '2027-06-14T08:00:00.000Z',
    registrationEnabled: false,
    capacity: null,
    inPlan: false,
    ...over,
  };
}

/**
 * The plug-in's three routes, answering what the test put in and recording
 * what was written — no network, no host.
 */
export class FakeApi {
  rows: PersonalProgramItem[] = [];
  /** The language of every read, in order. */
  reads: string[] = [];
  added: string[] = [];
  removed: string[] = [];
  failRead = false;
  failWrite = false;
  noSession = false;
  /** When set, reads wait until the test resolves them. */
  defer = false;
  pending: ((rows: PersonalProgramItem[]) => void)[] = [];

  plan(_eventId: string, locale: string): Promise<PersonalProgramItem[]> {
    this.reads.push(locale);
    if (this.noSession) return Promise.reject(new NotSignedInError());
    if (this.failRead) return Promise.reject(new Error('boom'));
    if (this.defer) {
      return new Promise((resolve) => this.pending.push(resolve));
    }
    return Promise.resolve(this.rows);
  }

  add(programItemId: string): Promise<void> {
    this.added.push(programItemId);
    return this.write();
  }

  remove(programItemId: string): Promise<void> {
    this.removed.push(programItemId);
    return this.write();
  }

  private write(): Promise<void> {
    if (this.noSession) return Promise.reject(new NotSignedInError());
    return this.failWrite
      ? Promise.reject(new Error('boom'))
      : Promise.resolve();
  }
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
