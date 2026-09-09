import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
  type OnDestroy,
} from '@angular/core';
import {
  MAX_CHECKIN_CODE_LENGTH,
  type AdmissionRow,
  type CheckinResult,
} from '@trefaro/shared-models';
import { PluginRequestError } from '@trefaro/shared-plugin-kit';
import { CameraScanner, cameraAvailable } from './camera-scanner';
import { when, word } from './plugin-words';
import { QrCheckinApi } from './qr-checkin-api';

/**
 * The door (FR 3.16, F199) — **milestone M11**.
 *
 * Mounted at `event-dashboard`, the fourth section under the tiles. Three ways
 * to read the same code, and they all end in the same call: the camera where
 * the browser hands one over, the field beside it, and a button in every row of
 * the list. **A door may not depend on a camera driver** — a cellar without a
 * lens, a permission somebody declined, a phone whose battery went — so the
 * half that always works is the half this repository's suites can also prove,
 * and that is not a coincidence.
 *
 * **A second scan is not an error** (E53). The server answers 200 with the
 * first instant, and this says "already here since 09:12" — the sentence
 * somebody holding a door needs. Only a code no ticket carries is a refusal,
 * and it says nothing about who is expected behind the door.
 *
 * The list is what an organizer reads between arrivals: the event's confirmed
 * registrations by name, each with the instant they were let in. A row that was
 * just admitted is updated in place rather than by reloading the list —
 * somebody is standing in front of the screen, and a page that jumps back to
 * its first row while they wait is a page that lost their place.
 */
@Component({
  selector: 'trefaro-organizer-door',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <h2 class="panel__title">{{ text().doorTitle }}</h2>
      <p class="note">{{ text().doorIntro }}</p>

      <div class="door">
        @if (hasCamera) {
          <button
            type="button"
            class="camera__toggle"
            [disabled]="busy()"
            (click)="toggleCamera()"
          >
            {{ scanning() ? text().stopCamera : text().startCamera }}
          </button>
        }

        <!-- Always in the document, hidden while it is off: an element that
             appears only once the camera runs cannot be handed to the scanner
             that is supposed to fill it. -->
        <video class="camera" [hidden]="!scanning()" #camera></video>
        @if (scanning()) {
          <p class="note">{{ text().scanning }}</p>
        }
        @if (cameraFailed()) {
          <p class="note note--loud" role="alert">{{ text().cameraFailed }}</p>
        }

        <form class="typed" (submit)="typeIn($event)">
          <fieldset [disabled]="busy()">
            <label class="typed__label" for="qr-checkin-code">
              {{ text().codeLabel }}
            </label>
            <div class="typed__row">
              <input
                id="qr-checkin-code"
                name="code"
                type="text"
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
                [attr.maxlength]="maxCodeLength"
              />
              <button type="submit" class="primary">{{ text().admit }}</button>
            </div>
          </fieldset>
        </form>
      </div>

      @if (result(); as answer) {
        <p class="verdict" [class.verdict--again]="answer.alreadyCheckedIn">
          <b>{{ answer.firstName }} {{ answer.lastName }}</b>
          @if (answer.alreadyCheckedIn) {
            · {{ text().alreadyHere }} {{ moment(answer.checkedInAt) }}
          } @else {
            · {{ text().admitted }}
          }
        </p>
      } @else if (refusal(); as sentence) {
        <p class="verdict verdict--no" role="alert">{{ sentence }}</p>
      }

      <h3 class="list__title">{{ text().listTitle }}</h3>
      @if (loading()) {
        <p class="note">{{ text().loading }}</p>
      } @else if (rows().length === 0) {
        <p class="note">{{ text().emptyList }}</p>
      } @else {
        <table class="list">
          <thead>
            <tr>
              <th>{{ text().nameColumn }}</th>
              <th>{{ text().stateColumn }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.registrationId) {
              <tr [class.list__row--in]="row.checkedInAt">
                <td class="list__name">
                  {{ row.lastName }}, {{ row.firstName }}
                </td>
                <td class="list__state">
                  @if (row.checkedInAt; as at) {
                    {{ text().checkedIn }} · {{ moment(at) }}
                  } @else {
                    {{ text().waiting }}
                  }
                </td>
                <td class="list__action">
                  @if (!row.checkedInAt) {
                    <button
                      type="button"
                      [disabled]="busy()"
                      (click)="admit(row)"
                    >
                      {{ text().admit }}
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
        @if (more()) {
          <button class="more" type="button" (click)="loadMore()">
            {{ text().more }}
          </button>
        }
      }

      @if (failed()) {
        <p class="note note--loud" role="alert">{{ text().error }}</p>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      font-family: var(--trefaro-font-family, system-ui, sans-serif);
    }

    .panel {
      border: 1px solid color-mix(in oklab, currentColor 15%, transparent);
      border-radius: 0.6rem;
      padding: 1rem 1.1rem;
    }

    .panel__title {
      margin: 0 0 0.4rem;
      font-size: 1.05rem;
    }

    .note {
      margin: 0 0 0.6rem;
      font-size: 0.9rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }

    .note--loud {
      color: inherit;
      font-weight: 600;
    }

    .door {
      display: flex;
      flex-direction: column;
      align-items: start;
      gap: 0.5rem;
      margin-block-end: 0.9rem;
    }

    .camera {
      inline-size: min(100%, 20rem);
      border-radius: 0.5rem;
      background: #000000;
    }

    fieldset {
      margin: 0;
      padding: 0;
      border: 0;
    }

    .typed__label {
      display: block;
      font-size: 0.85rem;
      margin-block-end: 0.2rem;
    }

    .typed__row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    input {
      min-inline-size: 14rem;
      padding: 0.45rem 0.6rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      background: transparent;
      color: inherit;
      font: inherit;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      text-transform: uppercase;
    }

    button {
      padding: 0.45rem 0.9rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      background: transparent;
      color: inherit;
      font: inherit;
    }

    button.primary {
      border: 0;
      background: var(--trefaro-color-primary, #1f6f5c);
      color: var(--trefaro-color-on-primary, #ffffff);
      font-weight: 600;
    }

    button:disabled {
      opacity: 0.55;
    }

    .verdict {
      margin: 0 0 0.9rem;
      padding: 0.5rem 0.7rem;
      border-radius: 0.4rem;
      border-inline-start: 3px solid var(--trefaro-color-primary, #1f6f5c);
      background: color-mix(in oklab, currentColor 6%, transparent);
    }

    .verdict--again,
    .verdict--no {
      border-inline-start-color: color-mix(
        in oklab,
        currentColor 45%,
        transparent
      );
    }

    .list__title {
      margin: 0 0 0.4rem;
      font-size: 0.95rem;
    }

    .list {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    .list th {
      text-align: start;
      font-weight: 600;
      padding-block-end: 0.3rem;
      border-block-end: 1px solid
        color-mix(in oklab, currentColor 15%, transparent);
    }

    .list td {
      padding-block: 0.35rem;
      border-block-end: 1px solid
        color-mix(in oklab, currentColor 8%, transparent);
      vertical-align: baseline;
    }

    .list__row--in .list__state {
      color: var(--trefaro-color-primary, #1f6f5c);
      font-weight: 600;
    }

    .list__action {
      text-align: end;
    }

    .more {
      margin-block-start: 0.6rem;
    }
  `,
})
export class OrganizerDoor implements OnDestroy {
  /** The event this door belongs to, handed over by the hook point. */
  readonly eventId = input<string | null>(null);
  readonly locale = input<string>('en');
  readonly strings = input<Readonly<Record<string, string>>>({});

  private readonly api = inject(QrCheckinApi);
  private readonly camera = viewChild<ElementRef<HTMLVideoElement>>('camera');
  private readonly scanner = new CameraScanner();

  /**
   * What the field accepts — the server's bound, not a guess about this
   * version's codes: a longer string is a camera that read a poster, and it is
   * refused here rather than sent.
   */
  protected readonly maxCodeLength = MAX_CHECKIN_CODE_LENGTH;
  protected readonly hasCamera = cameraAvailable();

  private readonly loaded = signal<readonly AdmissionRow[]>([]);
  protected readonly rows = this.loaded.asReadonly();
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly scanning = signal(false);
  protected readonly cameraFailed = signal(false);
  protected readonly result = signal<CheckinResult | null>(null);
  private readonly refusalKey = signal<string>('');

  private total = 0;
  private page = 0;
  /** Counts the reads, so a late answer to an earlier event is dropped. */
  private reads = 0;

  protected readonly more = computed(() => this.rows().length < this.total);

  protected readonly text = computed(() => {
    const strings = this.strings();
    const say = (key: string): string => word(strings, key);
    return {
      doorTitle: say('doorTitle'),
      doorIntro: say('doorIntro'),
      codeLabel: say('codeLabel'),
      admit: say('admit'),
      startCamera: say('startCamera'),
      stopCamera: say('stopCamera'),
      scanning: say('scanning'),
      cameraFailed: say('cameraFailed'),
      admitted: say('admitted'),
      alreadyHere: say('alreadyHere'),
      listTitle: say('listTitle'),
      emptyList: say('emptyList'),
      nameColumn: say('nameColumn'),
      stateColumn: say('stateColumn'),
      checkedIn: say('checkedIn'),
      waiting: say('waiting'),
      more: say('more'),
      loading: say('loading'),
      error: say('error'),
    };
  });

  /** The sentence a refusal deserves, resolved after a language switch. */
  protected readonly refusal = computed(() => {
    const key = this.refusalKey();
    return key ? word(this.strings(), key) : '';
  });

  constructor() {
    effect(() => {
      const eventId = this.eventId();
      if (!eventId) return;
      void this.reload(eventId);
    });
  }

  /** In the reader's own language and zone — the door is where the reader is. */
  protected moment(iso: string): string {
    return when(this.locale(), iso);
  }

  /**
   * The typed half (F199).
   *
   * Read out of the form on submit rather than bound, like every form in a
   * bundle, and stripped of whitespace: the code is printed in groups so a
   * person can read it out, and whoever types it back in types the gaps too.
   * The field is emptied only when the door answered — a refusal leaves what
   * was typed, so the next attempt is a correction rather than a retype.
   */
  protected typeIn(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const code = String(new FormData(form).get('code') ?? '').replace(
      /\s+/g,
      '',
    );
    if (!code) return;
    void this.send(code, () => form.reset());
  }

  protected admit(row: AdmissionRow): void {
    void this.send(row.code);
  }

  protected toggleCamera(): void {
    if (this.scanning()) {
      this.scanner.stop();
      this.scanning.set(false);
      return;
    }
    void this.startCamera();
  }

  private async startCamera(): Promise<void> {
    const video = this.camera()?.nativeElement;
    if (!video) return;
    this.cameraFailed.set(false);
    try {
      await this.scanner.start(video, (code) => void this.send(code));
      this.scanning.set(true);
    } catch {
      // No camera, no permission, no secure context: one sentence, and the
      // field beside it still works. That is the whole point of F199.
      this.scanning.set(false);
      this.cameraFailed.set(true);
    }
  }

  /**
   * One code at the door, however it got here.
   *
   * The answer replaces the verdict above the list and updates the row it
   * belongs to in place. A code for another event is a perfectly good answer —
   * somebody at the wrong door learns the name and the event they are holding a
   * ticket for is not this one — so the row simply is not there to update.
   */
  private async send(code: string, done?: () => void): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.result.set(null);
    this.refusalKey.set('');
    try {
      const answer = await this.api.checkIn(code);
      this.result.set(answer);
      this.mark(answer);
      done?.();
    } catch (error: unknown) {
      const unknown =
        error instanceof PluginRequestError && error.status === 404;
      this.refusalKey.set(unknown ? 'unknownCode' : 'error');
    } finally {
      this.busy.set(false);
    }
  }

  /** Writes an admission into the row it belongs to, if that row is loaded. */
  private mark(answer: CheckinResult): void {
    this.loaded.update((rows) =>
      rows.map((row) =>
        row.registrationId === answer.registrationId
          ? { ...row, checkedInAt: answer.checkedInAt }
          : row,
      ),
    );
  }

  protected loadMore(): void {
    const eventId = this.eventId();
    if (eventId) void this.load(eventId, this.page + 1);
  }

  private async reload(eventId: string): Promise<void> {
    this.loaded.set([]);
    this.total = 0;
    this.page = 0;
    this.result.set(null);
    this.refusalKey.set('');
    await this.load(eventId, 1);
  }

  private async load(eventId: string, page: number): Promise<void> {
    const run = ++this.reads;
    this.loading.set(page === 1);
    try {
      const answer = await this.api.admissions(eventId, page);
      if (run !== this.reads) return;
      this.total = answer.total;
      this.page = answer.page;
      this.loaded.update((rows) =>
        page === 1 ? [...answer.rows] : [...rows, ...answer.rows],
      );
      this.failed.set(false);
    } catch {
      if (run !== this.reads) return;
      this.failed.set(true);
    } finally {
      if (run === this.reads) this.loading.set(false);
    }
  }

  /** The lamp beside the lens goes out when this section does. */
  ngOnDestroy(): void {
    this.scanner.stop();
  }
}
