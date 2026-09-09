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
} from '@angular/core';
import type { CheckinTicket } from '@trefaro/shared-models';
import {
  NotSignedInError,
  PluginRequestError,
} from '@trefaro/shared-plugin-kit';
import { when, word } from './plugin-words';
import { QrCheckinApi } from './qr-checkin-api';
import { renderQrCode } from './qr-code';

/** Groups of four, so a code can be read out without losing the place. */
const GROUP_SIZE = 4;

/**
 * The ticket, on the page the receipt links to (FR 3.16, E54).
 *
 * Mounted at `my-registration`, the hook point this plug-in brought with it.
 * **The mail carries the way here, not the code** (F198): a core mail may not
 * contain plug-in content, an image in an attachment gets filtered by mailboxes
 * and cannot be reissued after a loss, and the mail port of this application
 * takes no attachments at all. So the confirmation receipt links the
 * self-service page — as it has since phase 1 (E11) — and the code is drawn
 * here, in the browser, from the characters the plug-in issued.
 *
 * **Two credentials, one section** (F148). The page answers a signed link and a
 * session, and so does this: with a token it asks the anonymous route, with a
 * registration id it asks the participant's own. Which one it has is the
 * host's to say — the address bar is not read here, for the reason `mountPoint`
 * is handed over rather than guessed (F202).
 *
 * A registration that is not confirmed has no ticket, and neither has one that
 * was given up: both are the same sentence here, because the server answers
 * both with the same 404 and the difference is not this reader's to learn.
 */
@Component({
  selector: 'trefaro-participant-ticket',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <h2 class="panel__title">{{ text().ticketTitle }}</h2>

      @if (loading()) {
        <p class="note">{{ text().loading }}</p>
      } @else if (message(); as sentence) {
        <p class="note" role="status">{{ sentence }}</p>
      } @else if (ticket(); as mine) {
        <p class="note">{{ text().ticketIntro }}</p>

        <!-- Black on white, on its own white card: the one thing in this
             application that does not follow the instance's colours, because a
             tinted code is a code a scanner argues with. -->
        <div class="code" #target></div>

        <!-- Spacing, not spaces: the groups are separate elements, so the text
             of this line is exactly the code, and a test guards that. -->
        <p class="characters">
          @for (group of groups(mine.code); track $index) {
            <span class="characters__group">{{ group }}</span>
          }
        </p>
        <p class="note">{{ text().codeHint }}</p>

        @if (mine.checkedInAt; as at) {
          <p class="arrived">{{ text().checkedIn }} · {{ moment(at) }}</p>
        }
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
      margin: 0 0 0.8rem;
      font-size: 1.05rem;
    }

    .note {
      margin: 0 0 0.6rem;
      font-size: 0.9rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }

    /* White, whatever the page around it is. A dark theme that tinted the
       quiet zone would leave a code no reader can find the edges of. */
    .code {
      display: flex;
      justify-content: center;
      max-inline-size: 18rem;
      margin-block: 0.8rem;
      padding: 0.5rem;
      border-radius: 0.5rem;
      background: #ffffff;
    }

    .characters {
      margin: 0 0 0.35rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 1rem;
      /* Wraps rather than pushing the page sideways on a narrow phone. */
      overflow-wrap: anywhere;
    }

    /* Spacing, not spaces: the groups are separate elements, so the text of
       this line is still exactly the code — whoever copies it copies
       something the door accepts. */
    .characters__group + .characters__group {
      margin-inline-start: 0.55em;
    }

    .arrived {
      margin: 0.6rem 0 0;
      font-weight: 600;
      color: var(--trefaro-color-primary, #1f6f5c);
    }
  `,
})
export class ParticipantTicket {
  /** The signed token from the personal link, when that is how somebody came. */
  readonly token = input<string | null>(null);

  /** The registration on the page, when a session is what opened it. */
  readonly registrationId = input<string | null>(null);

  readonly locale = input<string>('en');
  readonly strings = input<Readonly<Record<string, string>>>({});

  private readonly api = inject(QrCheckinApi);
  private readonly target = viewChild<ElementRef<HTMLElement>>('target');

  protected readonly ticket = signal<CheckinTicket | null>(null);
  protected readonly loading = signal(true);
  /** A word to show instead of the code — missing ticket, refusal, no session. */
  private readonly problem = signal<string>('');
  /** Counts the reads, so a late answer to an earlier question is dropped. */
  private reads = 0;

  protected readonly text = computed(() => {
    const strings = this.strings();
    const say = (key: string): string => word(strings, key);
    return {
      ticketTitle: say('ticketTitle'),
      ticketIntro: say('ticketIntro'),
      codeHint: say('codeHint'),
      checkedIn: say('checkedIn'),
      loading: say('loading'),
    };
  });

  /** The sentence in place of a code, resolved after a language switch. */
  protected readonly message = computed(() => {
    const key = this.problem();
    return key ? word(this.strings(), key) : '';
  });

  constructor() {
    effect(() => {
      const token = this.token();
      const registrationId = this.registrationId();
      void this.load(token, registrationId);
    });

    // The picture is drawn after the code arrives, and again if it changes —
    // rendering is asynchronous, so it cannot happen in the template.
    effect(() => {
      const code = this.ticket()?.code ?? '';
      const host = this.target()?.nativeElement;
      if (host) void this.draw(host, code);
    });
  }

  protected groups(code: string): readonly string[] {
    return code.match(new RegExp(`.{1,${GROUP_SIZE}}`, 'g')) ?? [code];
  }

  /** In the reader's own language and zone — a door has no timezone of its own. */
  protected moment(iso: string): string {
    return when(this.locale(), iso);
  }

  private async load(
    token: string | null,
    registrationId: string | null,
  ): Promise<void> {
    const run = ++this.reads;
    this.loading.set(true);
    this.problem.set('');
    try {
      const ticket = token
        ? await this.api.ticketByLink(token)
        : registrationId
          ? await this.api.ticketOf(registrationId)
          : null;
      if (run !== this.reads) return;
      this.ticket.set(ticket);
      // A session whose registrations hold no ticket for this one reads the
      // same as a 404 on the link: there is none, and why is not the point.
      if (!ticket) this.problem.set('noTicket');
    } catch (error: unknown) {
      if (run !== this.reads) return;
      this.ticket.set(null);
      this.problem.set(reasonFor(error));
    } finally {
      if (run === this.reads) this.loading.set(false);
    }
  }

  private async draw(host: HTMLElement, code: string): Promise<void> {
    if (!code) {
      host.replaceChildren();
      return;
    }
    try {
      host.replaceChildren(await renderQrCode(code));
    } catch {
      // The characters underneath are the ticket too, so a failed drawing
      // leaves a usable page rather than an error on top of one.
      host.replaceChildren();
    }
  }
}

/**
 * Which sentence a refusal deserves.
 *
 * A 401 is **not** a failure here (E58): the page answers a link as well as a
 * session, so "no session" means the second way in has expired — an invitation
 * to log in, not something broken. A 404 is a registration without a ticket:
 * not confirmed, given up, or a link that was never valid.
 */
function reasonFor(error: unknown): string {
  if (error instanceof NotSignedInError) return 'signIn';
  if (error instanceof PluginRequestError && error.status === 404) {
    return 'noTicket';
  }
  return 'error';
}
