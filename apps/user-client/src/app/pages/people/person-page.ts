import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import type { ProfileFieldPublic, PublicProfile } from '@trefaro/shared-models';
import { ParticipantProfileService } from '../../features/profiles/participant-profile.service';
import { ProfileSearchService } from '../../features/profiles/profile-search.service';

/** One question and what this person answered — resolved for the template. */
interface Answer {
  readonly label: string;
  readonly value: string;
}

/**
 * Somebody else's profile (FR 4.4, UC 12).
 *
 * What a person published about themselves: the picture, the name, what they
 * work on, and their answers to the questions this instance asks (E35). No
 * address — a participant reaches another participant through a conversation
 * (FR 4.5, AP 6), and a screen that showed a mailbox would make the community
 * exportable (F55).
 *
 * Two decisions worth naming:
 *
 * 1. **A 404 is a sentence, not a broken page.** A profile can leave the search
 *    between the list and the click — withdrawing the opt-in is meant to work
 *    immediately (E37) — so "not available, perhaps withdrawn" is the normal
 *    case here rather than an error, and it reads the same as an id that never
 *    existed (F124).
 * 2. **Only answered questions appear, and only ones still being asked.** The
 *    organizer's panel lists every question and every leftover answer, because
 *    that is an audit of a form (F34); a reader here is looking at a person, and
 *    a row saying `local-group: —` tells them nothing about anybody.
 */
@Component({
  selector: 'trefaro-person-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe],
  template: `
    @if (person(); as profile) {
      <div class="head">
        <!-- Decorative: the name is the heading right beside it. -->
        @if (profile.avatarUrl; as url) {
          <img class="avatar" [src]="url" alt="" />
        } @else {
          <span class="avatar avatar--empty" aria-hidden="true">
            {{ initials() }}
          </span>
        }
        <h1>{{ profile.firstName }} {{ profile.lastName }}</h1>
      </div>

      @if (profile.activityAreas; as areas) {
        <h2>{{ 'people.detail.activityAreas' | transloco }}</h2>
        <p>{{ areas }}</p>
      }

      @if (answers().length > 0) {
        <h2>{{ 'people.detail.about' | transloco }}</h2>
        <dl>
          @for (answer of answers(); track answer.label) {
            <dt>{{ answer.label }}</dt>
            <dd>{{ answer.value }}</dd>
          }
        </dl>
      }
    } @else if (error(); as problem) {
      <p class="notice" role="alert">
        {{ problem.key | transloco }}
        @if (problem.detail; as detail) {
          <span class="notice__detail">{{ detail }}</span>
        }
      </p>
    } @else {
      <p class="notice">{{ 'common.loading' | transloco }}</p>
    }

    <p>
      <a routerLink="/participants">{{ 'people.detail.back' | transloco }}</a>
    </p>
  `,
  styles: `
    :host {
      display: block;
      max-inline-size: 34rem;
    }

    .head {
      display: flex;
      align-items: center;
      gap: 0.9rem;
    }

    h1 {
      margin: 0;
      font-size: 1.4rem;
    }

    h2 {
      margin-block: 1.4rem 0.3rem;
      font-size: 1rem;
    }

    .avatar {
      display: grid;
      place-items: center;
      inline-size: 4rem;
      block-size: 4rem;
      border-radius: 50%;
      object-fit: cover;
      flex: none;
    }

    .avatar--empty {
      background: var(--trefaro-color-primary-soft);
      color: var(--trefaro-color-primary-strong);
      font-size: 1.4rem;
      font-weight: 600;
    }

    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.3rem 0.9rem;
      margin: 0;
    }

    dt {
      font-weight: 600;
    }

    dd {
      margin: 0;
    }

    .notice {
      color: var(--trefaro-color-primary-strong);
    }

    .notice__detail {
      display: block;
      font-size: 0.9rem;
    }
  `,
})
export class PersonPage {
  private readonly people = inject(ProfileSearchService);
  private readonly profiles = inject(ParticipantProfileService);
  private readonly i18n = inject(TranslationService);

  /** From the path, bound by `withComponentInputBinding()`. */
  readonly id = input<string>();

  protected readonly person = signal<PublicProfile | null>(null);
  protected readonly error = signal<Problem | null>(null);
  /** The questions this instance asks, so an answer can be labelled (E35). */
  private readonly fields = signal<readonly ProfileFieldPublic[]>([]);

  protected readonly initials = computed(() => {
    const profile = this.person();
    if (!profile) return '';
    return [profile.firstName, profile.lastName]
      .map((name) => [...name.trim()][0] ?? '')
      .join('')
      .toLocaleUpperCase(this.i18n.locale());
  });

  /**
   * The answers, in the order the form asks its questions.
   *
   * Read from the definitions rather than from the answers, so two profiles are
   * laid out the same way — and a question that has since been deleted drops
   * out with its label, which is the only honest thing to do with an answer
   * whose question nobody can read any more.
   */
  protected readonly answers = computed<readonly Answer[]>(() => {
    // Read for its dependency, not for its value: a tick answer is spelled out
    // in TypeScript below, and `translate()` reads a plain map — so without
    // this line a language switch would leave "Yes" in the old language (F72).
    this.i18n.locale();

    const profile = this.person();
    if (!profile) return [];

    return this.fields()
      .map((field) => ({
        label: field.label,
        value: this.reads(profile.customFields[field.key]),
      }))
      .filter((answer) => answer.value.length > 0);
  });

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.load(id);
    });

    void this.loadFields();
  }

  /**
   * How one answer reads.
   *
   * `formatAnswer` in `shared-models` does the same job for the organizer
   * client, and is deliberately not used here: it answers in English, which is
   * right for nothing this client shows (NFR 4). An unanswered question reads
   * as the empty string and is dropped by the caller rather than becoming a
   * dash — a reader is looking at a person, not at a form.
   */
  private reads(value: string | boolean | undefined): string {
    if (value === true) return this.i18n.translate('common.yes');
    if (value === false) return this.i18n.translate('common.no');
    return value ?? '';
  }

  private async load(id: string): Promise<void> {
    this.error.set(null);
    try {
      this.person.set(await this.people.get(id));
    } catch (error: unknown) {
      this.person.set(null);
      // A withdrawn profile is the normal case, not a failure — and its own
      // sentence says everything, so the server's explanation is deliberately
      // dropped here (F77 lets one through where it says more than a key can;
      // "no profile of that id is in the search" does not).
      this.error.set(
        isMissing(error)
          ? { key: 'people.detail.notFound', detail: null }
          : problemOf(error, 'people.detail.error'),
      );
    }
  }

  /**
   * Reads the questions, and says nothing if it cannot.
   *
   * The profile itself is worth showing without them: a name and a field of
   * activity are the two things somebody came here for, and unlabelled answers
   * are worth less than no answers.
   */
  private async loadFields(): Promise<void> {
    try {
      this.fields.set(await this.profiles.fields());
    } catch {
      this.fields.set([]);
    }
  }
}

/** Whether the server said "no such profile" rather than something else. */
function isMissing(error: unknown): boolean {
  return (error as { status?: number } | null)?.status === 404;
}
