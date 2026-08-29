import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppConfigService } from '@trefaro/shared-config';
import { problemOf, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import type {
  MediaLink,
  MediaLinkKind,
  OrganizerEvent,
  ProgramItem,
} from '@trefaro/shared-models';
import {
  MAX_MEDIA_LINKS_PER_EVENT,
  MAX_MEDIA_LINK_TITLE_LENGTH,
  MEDIA_LINKS_MODULE_KEY,
  MEDIA_LINK_KINDS,
  isWebUrl,
  mediaLinkKindKey,
} from '@trefaro/shared-models';
import { EventsAdminService } from '../../features/events/events-admin.service';
import { MediaLinksAdminService } from '../../features/media-links/media-links-admin.service';
import { ProgramAdminService } from '../../features/program/program-admin.service';

/** What a row's inputs hold until they are saved. */
interface LinkDraft {
  kind: MediaLinkKind;
  title: string;
  url: string;
  /** Empty string for "the whole event" — a select cannot hold `null`. */
  programItemId: string;
}

/**
 * The media links of one event (FR 3.6, F10, UC 10).
 *
 * What this page can do is deliberately small, because that is what F10 decided:
 * the instance *refers* to media somebody else hosts. There is no upload, no
 * player, and no preview — the title is what the organizer types, and nothing
 * here ever asks the target what it is called (F51). The address is shown as a
 * link so it can be checked, and that link opens in a new tab with
 * `rel="noopener noreferrer"`: no referrer, so following it does not tell the
 * other side which instance sent the visitor.
 *
 * Three things worth naming:
 *
 * 1. **The order is not editable.** Streams, then recordings, then materials,
 *    and within a kind the order they were added (F52). Changing a link's kind
 *    moves it, which is the only thing "move" could mean here.
 * 2. **A link may hang on a session.** Then it is rendered with that session on
 *    the landing page rather than in a list of forty URLs. Only sessions of this
 *    event are offered — the server refuses the rest, and the database cannot
 *    even store it.
 * 3. **The module can be switched off** (FR 1.5). Then this page says so instead
 *    of showing an editor whose every request answers 404 (F53).
 */
@Component({
  selector: 'trefaro-media-links-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe],
  template: `
    <header class="head">
      <div>
        <!-- The module's own name, from its descriptor's key: the page, the
             dashboard tile and the module administration are one thing. -->
        <h1>{{ 'modules.mediaLinks.title' | transloco }}</h1>
        <p class="meta">
          @if (event(); as item) {
            <a [routerLink]="['/series', seriesId(), 'events', item.id]">
              {{ item.name }}
            </a>
          }
          <span>{{ 'admin.mediaLinks.intro' | transloco }}</span>
        </p>
      </div>
      <a
        class="back"
        [routerLink]="['/series', seriesId(), 'events', eventId()]"
      >
        {{ 'admin.events.back' | transloco }}
      </a>
    </header>

    @if (!moduleEnabled()) {
      <p class="hint" role="status">
        {{ 'admin.mediaLinks.moduleOff' | transloco }}
      </p>
    } @else {
      @if (error(); as problem) {
        <p class="error" role="alert">
          {{ problem.key | transloco }}
          @if (problem.detail; as detail) {
            <span class="error__detail">{{ detail }}</span>
          }
        </p>
      }

      <section aria-labelledby="links-heading">
        <h2 id="links-heading">
          {{ 'admin.mediaLinks.heading' | transloco }}
        </h2>
        <p class="meta">{{ 'admin.mediaLinks.orderHint' | transloco }}</p>

        @if (links().length === 0) {
          <p class="meta">
            {{
              (loading() ? 'common.loading' : 'admin.mediaLinks.empty')
                | transloco
            }}
          </p>
        }

        <ol class="items">
          @for (link of links(); track link.id) {
            <li class="item">
              <div class="item__head">
                <span class="badge">{{ kindLabel(link.kind) }}</span>
                <a
                  class="item__target"
                  [href]="link.url"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ link.url }}
                </a>
              </div>

              <label>
                <span>{{ 'admin.mediaLinks.kind' | transloco }}</span>
                <!-- The chosen option is marked, rather than the select being
                     given a value: Angular writes the value property on the
                     element before the options exist, and the assignment is
                     then dropped without a word. The add form below has no such
                     problem, because its form directive waits for the options.
                     (No backticks in a template comment: they end the template
                     literal, and the errors surface somewhere else entirely.) -->
                <select (change)="edit(link.id, { kind: kindValue($event) })">
                  @for (kind of kinds; track kind) {
                    <option
                      [value]="kind"
                      [selected]="kind === draft(link.id).kind"
                    >
                      {{ kindLabel(kind) }}
                    </option>
                  }
                </select>
              </label>

              <label>
                <span>{{ 'admin.mediaLinks.linkTitle' | transloco }}</span>
                <input
                  [attr.maxlength]="maxTitleLength"
                  [value]="draft(link.id).title"
                  (input)="edit(link.id, { title: value($event) })"
                />
              </label>

              <label>
                <span>{{ 'admin.mediaLinks.address' | transloco }}</span>
                <input
                  type="url"
                  [value]="draft(link.id).url"
                  (input)="edit(link.id, { url: value($event) })"
                />
              </label>

              <label>
                <span>{{ 'admin.mediaLinks.belongsTo' | transloco }}</span>
                <select
                  (change)="edit(link.id, { programItemId: value($event) })"
                >
                  <option
                    value=""
                    [selected]="draft(link.id).programItemId === ''"
                  >
                    {{ 'admin.mediaLinks.wholeEvent' | transloco }}
                  </option>
                  @for (session of sessions(); track session.id) {
                    <option
                      [value]="session.id"
                      [selected]="session.id === draft(link.id).programItemId"
                    >
                      {{ session.title }}
                    </option>
                  }
                </select>
              </label>

              <div class="item__actions">
                <button
                  type="button"
                  [disabled]="busy() || !changed(link)"
                  (click)="save(link)"
                >
                  {{ 'admin.common.save' | transloco }}
                </button>
                <button
                  type="button"
                  class="danger"
                  [disabled]="busy()"
                  (click)="remove(link)"
                >
                  {{ 'admin.common.delete' | transloco }}
                </button>
              </div>
            </li>
          }
        </ol>
      </section>

      <section aria-labelledby="add-heading">
        <h2 id="add-heading">{{ 'admin.mediaLinks.add' | transloco }}</h2>
        @if (full()) {
          <p class="meta">
            {{ 'admin.mediaLinks.full' | transloco: { count: maxLinks } }}
          </p>
        } @else {
          <form [formGroup]="form" (ngSubmit)="add()" novalidate>
            <!-- Closed while a request is in flight: the form clears itself once
                 a link is saved, and an address typed in that window would be
                 wiped by the reset. -->
            <fieldset [disabled]="busy()">
              <label>
                <span>{{ 'admin.mediaLinks.kind' | transloco }}</span>
                <select formControlName="kind">
                  @for (kind of kinds; track kind) {
                    <option [value]="kind">{{ kindLabel(kind) }}</option>
                  }
                </select>
              </label>

              <label>
                <span>{{ 'admin.mediaLinks.linkTitle' | transloco }}</span>
                <input
                  formControlName="title"
                  [attr.maxlength]="maxTitleLength"
                  [placeholder]="
                    'admin.mediaLinks.titlePlaceholder' | transloco
                  "
                />
              </label>

              <label>
                <span>{{ 'admin.mediaLinks.address' | transloco }}</span>
                <!-- The address stays as it is: an example URL is not a
                     sentence, and a translated host name would be a dead one. -->
                <input
                  formControlName="url"
                  type="url"
                  placeholder="https://tube.example.org/w/opening-keynote"
                />
              </label>

              <label>
                <span>{{ 'admin.mediaLinks.belongsTo' | transloco }}</span>
                <select formControlName="programItemId">
                  <option value="">
                    {{ 'admin.mediaLinks.wholeEvent' | transloco }}
                  </option>
                  @for (session of sessions(); track session.id) {
                    <option [value]="session.id">{{ session.title }}</option>
                  }
                </select>
              </label>

              <button type="submit">
                {{ 'admin.mediaLinks.addSubmit' | transloco }}
              </button>
            </fieldset>
          </form>
        }
      </section>
    }
  `,
  styles: `
    .head {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .meta {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      max-inline-size: 40rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
      font-size: 0.9rem;
    }

    .error,
    .hint {
      padding: 0.6rem 0.8rem;
      border-radius: 0.4rem;
      background: color-mix(in oklab, currentColor 8%, transparent);
      max-inline-size: 40rem;
    }

    .error {
      color: var(--trefaro-color-primary-strong);
    }

    section {
      margin-block-start: 2rem;
    }

    .items {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin: 1rem 0 0;
      padding: 0;
      list-style: none;
    }

    .item,
    fieldset {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 1rem;
      border: 1px solid color-mix(in oklab, currentColor 15%, transparent);
      border-radius: 0.6rem;
      inline-size: min(40rem, 100%);
    }

    .item__head {
      display: flex;
      align-items: baseline;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    .item__target {
      font-size: 0.9rem;
      overflow-wrap: anywhere;
    }

    .badge {
      padding: 0.1rem 0.5rem;
      border-radius: 1rem;
      font-size: 0.8rem;
      background: color-mix(in oklab, currentColor 12%, transparent);
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      font-size: 0.9rem;
    }

    label span {
      font-weight: 600;
    }

    input,
    select {
      padding: 0.45rem 0.5rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      font: inherit;
    }

    .item__actions {
      display: flex;
      gap: 0.6rem;
      margin-block-start: 0.3rem;
    }

    button {
      padding: 0.4rem 0.8rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      background: transparent;
      font: inherit;
      cursor: pointer;
    }

    button[type='submit'] {
      align-self: start;
      border: 0;
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
      font-weight: 600;
    }

    .danger {
      color: var(--trefaro-color-primary-strong);
    }

    .back {
      white-space: nowrap;
    }
  `,
})
export class MediaLinksPage {
  /** Both bound from the route by `withComponentInputBinding()`. */
  readonly seriesId = input.required<string>();
  readonly eventId = input.required<string>();

  protected readonly kinds = MEDIA_LINK_KINDS;
  protected readonly maxLinks = MAX_MEDIA_LINKS_PER_EVENT;
  protected readonly maxTitleLength = MAX_MEDIA_LINK_TITLE_LENGTH;

  private readonly events = inject(EventsAdminService);
  private readonly mediaLinks = inject(MediaLinksAdminService);
  private readonly program = inject(ProgramAdminService);
  private readonly config = inject(AppConfigService);
  private readonly i18n = inject(TranslationService);

  protected readonly event = signal<OrganizerEvent | null>(null);
  protected readonly links = signal<readonly MediaLink[]>([]);
  protected readonly sessions = signal<readonly ProgramItem[]>([]);
  protected readonly error = signal<Problem | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);

  /** What the row inputs hold, keyed by link id, until Save is pressed. */
  private readonly drafts = signal<Record<string, LinkDraft>>({});

  /**
   * Whether the module is on at all (FR 1.5).
   *
   * From the configuration this client fetched at startup, which is the same
   * state the server's guard reads (F53) — so the editor is offered exactly when
   * its endpoints answer.
   */
  protected readonly moduleEnabled = computed(() =>
    this.config.isModuleEnabled(MEDIA_LINKS_MODULE_KEY),
  );

  protected readonly full = computed(
    () => this.links().length >= MAX_MEDIA_LINKS_PER_EVENT,
  );

  protected readonly form = inject(FormBuilder).nonNullable.group({
    kind: ['recording' as MediaLinkKind],
    title: ['', Validators.required],
    url: ['', Validators.required],
    programItemId: [''],
  });

  constructor() {
    effect(() => {
      void this.load(this.eventId());
    });
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  /** A `<select>` hands over a string; the kinds are the only values it offers. */
  protected kindValue(event: Event): MediaLinkKind {
    return (event.target as HTMLSelectElement).value as MediaLinkKind;
  }

  /**
   * The name of a kind, from the catalogue (AP 8 of phase 2).
   *
   * A method rather than a `computed()`, so it is re-evaluated whenever this
   * view is — which a language change does through the pipes elsewhere on the
   * page. The rest of this client follows in AP 9.
   */
  protected kindLabel(kind: MediaLinkKind): string {
    return this.i18n.translate(mediaLinkKindKey(kind));
  }

  protected draft(id: string): LinkDraft {
    return this.drafts()[id] ?? blankDraft();
  }

  protected edit(id: string, patch: Partial<LinkDraft>): void {
    this.drafts.update((drafts) => ({
      ...drafts,
      [id]: { ...this.draft(id), ...patch },
    }));
  }

  /** Whether this row differs from what the server holds. */
  protected changed(link: MediaLink): boolean {
    const draft = this.draft(link.id);
    const saved = draftOf(link);
    return (
      draft.kind !== saved.kind ||
      draft.title !== saved.title ||
      draft.url !== saved.url ||
      draft.programItemId !== saved.programItemId
    );
  }

  protected async add(): Promise<void> {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    // Checked here as well as on the server: an organizer who pasted the page
    // title instead of the address should not have to wait for a round trip to
    // find out.
    if (!isWebUrl(raw.url)) {
      this.error.set({ key: 'admin.mediaLinks.errorUrl', detail: null });
      return;
    }

    await this.change(async () => {
      await this.mediaLinks.create(this.eventId(), {
        kind: raw.kind,
        title: raw.title,
        url: raw.url,
        programItemId: raw.programItemId || null,
      });
      this.form.reset();
    });
  }

  protected async save(link: MediaLink): Promise<void> {
    const draft = this.draft(link.id);
    if (!isWebUrl(draft.url)) {
      this.error.set({ key: 'admin.mediaLinks.errorUrl', detail: null });
      return;
    }

    await this.change(() =>
      this.mediaLinks.update(link.id, {
        kind: draft.kind,
        title: draft.title,
        url: draft.url,
        programItemId: draft.programItemId || null,
      }),
    );
  }

  protected async remove(link: MediaLink): Promise<void> {
    const question = this.i18n.translate('admin.mediaLinks.confirmRemove', {
      title: link.title,
    });
    if (!confirm(question)) return;
    await this.change(() => this.mediaLinks.remove(link.id));
  }

  private async load(eventId: string): Promise<void> {
    this.loading.set(true);
    try {
      this.event.set(await this.events.get(eventId));
    } catch (error: unknown) {
      this.event.set(null);
      this.loading.set(false);
      this.report(error, 'admin.events.errorMissing');
      return;
    }

    // Only when the module is on: its endpoints answer 404 while it is off, and
    // an error message about that would explain a configuration decision as a
    // failure.
    if (!this.moduleEnabled()) {
      this.loading.set(false);
      return;
    }

    try {
      // The sessions are what the "belongs to" select offers. Their own view
      // owns the programme; this page only needs the titles.
      const [links, sessions] = await Promise.all([
        this.mediaLinks.list(eventId),
        this.program.list(eventId),
      ]);
      this.apply(links);
      this.sessions.set(sessions);
      this.error.set(null);
    } catch (error: unknown) {
      this.report(error, 'admin.mediaLinks.errorLoad');
    } finally {
      this.loading.set(false);
    }
  }

  /** Replaces the list and the drafts that belong to it in one step. */
  private apply(links: readonly MediaLink[]): void {
    this.links.set(links);
    this.drafts.set(
      Object.fromEntries(links.map((link) => [link.id, draftOf(link)])),
    );
  }

  private async change(action: () => Promise<unknown>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
      // Read back rather than patched in place: the server owns the order, and
      // the order is the kind (F52).
      this.apply(await this.mediaLinks.list(this.eventId()));
    } catch (error: unknown) {
      this.report(error, 'admin.fields.errorSave');
    } finally {
      this.busy.set(false);
    }
  }

  private report(error: unknown, key: string): void {
    this.error.set(problemOf(error, key));
  }
}

function blankDraft(): LinkDraft {
  return { kind: 'recording', title: '', url: '', programItemId: '' };
}

/** The row values of one link. `null` becomes '', because a select holds strings. */
function draftOf(link: MediaLink): LinkDraft {
  return {
    kind: link.kind,
    title: link.title,
    url: link.url,
    programItemId: link.programItemId ?? '',
  };
}
