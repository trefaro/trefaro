import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import type { ProfileSearchHit } from '@trefaro/shared-models';
import { ParticipantSessionService } from '../../features/auth/participant-session.service';
import { ProfileSearchService } from '../../features/profiles/profile-search.service';

/**
 * Finding other participants (FR 4.4, UC 12).
 *
 * The community half of the thesis on one screen: people who met at an event
 * find each other again, across events and across series. Everybody in the
 * list put themselves there — `searchable` is off until its owner switches it
 * on (E37, F13) — and the lead sentence says so, because a reader who does not
 * know that reads this page as a directory of everybody.
 *
 * Four decisions worth naming:
 *
 * 1. **Empty boxes are a directory.** The page loads its first page before
 *    anything is typed. A search that answers nothing until it is asked
 *    something hides a community from the people in it, and there is nothing
 *    here that its owner did not publish.
 * 2. **Two boxes, not one with a syntax.** "Amina" and "election observation"
 *    are different questions (E36): the first may match a name or a topic, the
 *    second narrows to the topic alone.
 * 3. **Somebody who is not findable themselves is told so, here.** This is the
 *    screen where the switch makes sense, so it is the screen that mentions it
 *    — with a link to the profile rather than a second copy of the switch
 *    (F142).
 * 4. **"Show more" rather than a pager**, like "my registrations": the answer
 *    is short for most instances, and page numbers would be more machinery on
 *    screen than there are rows behind it.
 */
@Component({
  selector: 'trefaro-people-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe],
  template: `
    <h1>{{ 'people.title' | transloco }}</h1>
    <p class="lead">{{ 'people.lead' | transloco }}</p>

    @if (hidden()) {
      <p class="opt-in">
        {{ 'people.optIn' | transloco }}
        <a routerLink="/profile">{{ 'people.optInLink' | transloco }}</a>
      </p>
    }

    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <label>
        <span>{{ 'people.query' | transloco }}</span>
        <input formControlName="search" type="search" autocomplete="off" />
      </label>
      <label>
        <span>{{ 'people.activityAreas' | transloco }}</span>
        <input
          formControlName="activityAreas"
          type="search"
          autocomplete="off"
        />
      </label>
      <button type="submit" [disabled]="busy()">
        {{ (busy() ? 'people.searching' : 'people.submit') | transloco }}
      </button>
    </form>

    @if (error(); as problem) {
      <p class="notice" role="alert">
        {{ problem.key | transloco }}
        @if (problem.detail; as detail) {
          <span class="notice__detail">{{ detail }}</span>
        }
      </p>
    }

    @if (loaded()) {
      @if (rows().length === 0) {
        <p>{{ 'people.empty' | transloco }}</p>
      } @else {
        <ul class="people">
          @for (person of rows(); track person.id) {
            <li class="person">
              <a
                class="person__link"
                [routerLink]="['/participants', person.id]"
              >
                <!-- Decorative: the name is the link's own text, and reading
                     both would say the same thing twice. -->
                @if (person.avatarUrl; as url) {
                  <img class="person__avatar" [src]="url" alt="" />
                } @else {
                  <span class="person__avatar person__avatar--empty">{{
                    initials(person)
                  }}</span>
                }
                <span class="person__name">
                  {{ person.firstName }} {{ person.lastName }}
                </span>
              </a>
              @if (person.activityAreas; as areas) {
                <p class="person__areas">{{ areas }}</p>
              }
            </li>
          }
        </ul>

        @if (more()) {
          <button type="button" [disabled]="busy()" (click)="loadMore()">
            {{ 'people.more' | transloco }}
          </button>
        }
      }
    } @else if (!error()) {
      <p class="notice">{{ 'common.loading' | transloco }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
      max-inline-size: 40rem;
    }

    .lead,
    .opt-in {
      color: color-mix(in oklab, currentColor 75%, transparent);
    }

    form {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      margin-block-end: 1.4rem;
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    label > span {
      font-weight: 600;
    }

    input {
      padding: 0.6rem;
      border: 1px solid var(--trefaro-color-border);
      border-radius: var(--trefaro-radius-sm);
      font: inherit;
    }

    .people {
      display: grid;
      gap: 0.7rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .person {
      padding: 0.8rem 0.9rem;
      border: 1px solid var(--trefaro-color-border);
      border-radius: var(--trefaro-radius-md);
    }

    .person__link {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      font-weight: 600;
    }

    .person__avatar {
      display: grid;
      place-items: center;
      inline-size: 2.6rem;
      block-size: 2.6rem;
      border-radius: 50%;
      object-fit: cover;
      flex: none;
    }

    .person__avatar--empty {
      background: var(--trefaro-color-primary-soft);
      color: var(--trefaro-color-primary-strong);
      font-size: 0.9rem;
    }

    .person__areas {
      margin-block: 0.4rem 0;
      color: color-mix(in oklab, currentColor 75%, transparent);
      font-size: 0.9rem;
    }

    .notice {
      color: var(--trefaro-color-primary-strong);
    }

    .notice__detail {
      display: block;
      font-size: 0.9rem;
    }

    button {
      align-self: start;
      padding: 0.6rem 1.1rem;
      border: 0;
      border-radius: var(--trefaro-radius-sm);
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
      font: inherit;
      font-weight: 600;
    }

    button:disabled {
      opacity: 0.55;
    }
  `,
})
export class PeoplePage {
  private readonly people = inject(ProfileSearchService);
  private readonly session = inject(ParticipantSessionService);
  private readonly i18n = inject(TranslationService);
  private readonly builder = inject(FormBuilder);

  protected readonly form = this.builder.nonNullable.group({
    search: [''],
    activityAreas: [''],
  });

  protected readonly rows = signal<readonly ProfileSearchHit[]>([]);
  protected readonly error = signal<Problem | null>(null);
  protected readonly busy = signal(false);
  /**
   * Whether an answer has arrived at all.
   *
   * "Nobody matches" and "not asked yet" look the same in an empty array, and
   * only one of them deserves the sentence about an empty result (F146).
   */
  protected readonly loaded = signal(false);
  private readonly total = signal(0);
  private readonly page = signal(1);

  protected readonly more = computed(() => this.rows().length < this.total());

  /** Somebody who is searching but cannot be found — see the class comment. */
  protected readonly hidden = computed(
    () => this.session.participant()?.searchable === false,
  );

  constructor() {
    void this.fetch(1, false);
  }

  /**
   * The stand-in for a missing picture.
   *
   * The same construction as the avatar field's, and upper-cased by the
   * reader's locale for the same reason: a Turkish "i" is not an "I", and a
   * stand-in that misspells somebody's initial is worse than a blank circle.
   */
  protected initials(person: ProfileSearchHit): string {
    return [person.firstName, person.lastName]
      .map((name) => [...name.trim()][0] ?? '')
      .join('')
      .toLocaleUpperCase(this.i18n.locale());
  }

  protected async submit(): Promise<void> {
    // From the first page: a new question is a new result, and appending to the
    // old one would mix two answers into a list nobody asked for.
    await this.fetch(1, false);
  }

  protected async loadMore(): Promise<void> {
    if (this.busy() || !this.more()) return;
    await this.fetch(this.page() + 1, true);
  }

  private async fetch(page: number, append: boolean): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    const asked = this.form.getRawValue();

    try {
      const answer = await this.people.find({
        search: asked.search.trim(),
        activityAreas: asked.activityAreas.trim(),
        page,
      });
      this.rows.update((rows) =>
        append ? [...rows, ...answer.rows] : answer.rows,
      );
      this.total.set(answer.total);
      this.page.set(answer.page);
      this.loaded.set(true);
    } catch (error: unknown) {
      // What is on screen stays there: a failed second page is no reason to
      // take the first one away.
      if (!append) {
        this.rows.set([]);
        this.loaded.set(false);
      }
      this.error.set(problemOf(error, 'people.error'));
    } finally {
      this.busy.set(false);
    }
  }
}
