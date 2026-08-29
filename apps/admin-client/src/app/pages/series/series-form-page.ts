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
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type ApiError, type Problem } from '@trefaro/shared-http';
import {
  eventSeriesStatusKey,
  EVENT_SERIES_STATUSES,
} from '@trefaro/shared-models';
import { EventSeriesAdminService } from '../../features/event-series/event-series-admin.service';

/**
 * Create and edit an event series (UC 02, UC 03, FR 2.1, FR 2.2).
 *
 * One component for both, because the fields are the same and a second form
 * would drift from the first. The public address is left empty on purpose when
 * creating: the server derives it from the name, and an organizer should not
 * have to think about URLs to get started.
 *
 * The logo FR 2.1 asks for is missing here until uploads exist (AP 7); the
 * column is already in the schema.
 */
@Component({
  selector: 'trefaro-series-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe],
  template: `
    <h1>
      {{ (isNew() ? 'admin.series.new' : 'admin.series.edit') | transloco }}
    </h1>

    @if (error(); as problem) {
      <p class="error" role="alert">
        {{ problem.key | transloco }}
        @if (problem.detail; as detail) {
          <span class="error__detail">{{ detail }}</span>
        }
      </p>
    }

    <form [formGroup]="form" (ngSubmit)="submit()">
      <label for="name">{{ 'admin.series.name' | transloco }}</label>
      <input id="name" formControlName="name" required />

      <label for="description">
        {{ 'admin.series.description' | transloco }}
      </label>
      <textarea
        id="description"
        formControlName="description"
        rows="5"
        required
      >
      </textarea>

      <label for="slug">{{ 'admin.series.publicAddress' | transloco }}</label>
      <input
        id="slug"
        formControlName="slug"
        [placeholder]="'admin.common.slugPlaceholder' | transloco"
      />
      <small>{{ 'admin.series.slugHint' | transloco }}</small>

      <label for="websiteUrl">{{ 'admin.series.website' | transloco }}</label>
      <input id="websiteUrl" type="url" formControlName="websiteUrl" />

      <label for="contactEmail">
        {{ 'admin.series.contactEmail' | transloco }}
      </label>
      <input id="contactEmail" type="email" formControlName="contactEmail" />

      <label for="status">{{ 'admin.series.status' | transloco }}</label>
      <select id="status" formControlName="status">
        @for (status of statuses; track status) {
          <option [value]="status">{{ statusKey(status) | transloco }}</option>
        }
      </select>
      <small>{{ 'admin.series.statusHint' | transloco }}</small>

      <div class="actions">
        <button type="submit" [disabled]="busy()">
          {{
            (busy() ? 'admin.common.saving' : 'admin.common.save') | transloco
          }}
        </button>
        <a [routerLink]="isNew() ? '/' : ['/series', id()]">
          {{ 'admin.common.cancel' | transloco }}
        </a>
      </div>
    </form>
  `,
  styles: `
    form {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      inline-size: min(34rem, 100%);
    }

    label {
      font-weight: 600;
      margin-block-start: 0.75rem;
    }

    input,
    textarea,
    select {
      padding: 0.5rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      font: inherit;
    }

    small {
      color: color-mix(in oklab, currentColor 60%, transparent);
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-block-start: 1.5rem;
    }

    button[type='submit'] {
      padding: 0.55rem 0.9rem;
      border: 0;
      border-radius: 0.4rem;
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }

    .error {
      color: #a3341f;
    }
  `,
})
export class SeriesFormPage {
  /** Absent on `/series/new`; bound from the route otherwise. */
  readonly id = input<string | undefined>(undefined);

  protected readonly statuses = EVENT_SERIES_STATUSES;
  protected readonly statusKey = eventSeriesStatusKey;
  protected readonly isNew = computed(() => !this.id());
  protected readonly busy = signal(false);
  protected readonly error = signal<Problem | null>(null);

  private readonly admin = inject(EventSeriesAdminService);
  private readonly router = inject(Router);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    description: ['', Validators.required],
    slug: [''],
    websiteUrl: [''],
    contactEmail: [''],
    status: ['draft'],
  });

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.load(id);
    });
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    const payload = {
      name: raw.name,
      description: raw.description,
      // An untouched address field must not be sent: on an update it would
      // rewrite the slug, and on a create the server derives a better one.
      ...(raw.slug.trim() ? { slug: raw.slug.trim() } : {}),
      websiteUrl: raw.websiteUrl.trim() || null,
      contactEmail: raw.contactEmail.trim() || null,
      status: raw.status as (typeof EVENT_SERIES_STATUSES)[number],
    };

    try {
      const id = this.id();
      // Straight to the series afterwards, whether it was just created or
      // edited: adding the first event is what an organizer does next.
      const saved = id
        ? await this.admin.update(id, payload)
        : await this.admin.create(payload);
      await this.router.navigate(['/series', saved.id]);
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'admin.common.savingFailed'));
    } finally {
      this.busy.set(false);
    }
  }

  private async load(id: string): Promise<void> {
    this.error.set(null);
    try {
      const series = await this.admin.get(id);
      // A slow answer must not overwrite what the organizer has already typed.
      // Found by a Firefox e2e run that filled the form before it had loaded.
      if (this.form.dirty) return;
      this.form.setValue({
        name: series.name,
        description: series.description,
        slug: series.slug,
        websiteUrl: series.websiteUrl ?? '',
        contactEmail: series.contactEmail ?? '',
        status: series.status,
      });
    } catch (error: unknown) {
      this.error.set(
        (error as ApiError)?.status === 404
          ? { key: 'admin.series.errorMissing', detail: null }
          : problemOf(error, 'admin.common.loadingFailed'),
      );
    }
  }
}
