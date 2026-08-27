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
import type { ApiError } from '@trefaro/shared-http';
import { EVENT_SERIES_STATUSES } from '@trefaro/shared-models';
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
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <h1>{{ isNew() ? 'New event series' : 'Edit event series' }}</h1>

    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }

    <form [formGroup]="form" (ngSubmit)="submit()">
      <label for="name">Name</label>
      <input id="name" formControlName="name" required />

      <label for="description">Description</label>
      <textarea
        id="description"
        formControlName="description"
        rows="5"
        required
      >
      </textarea>

      <label for="slug">Public address</label>
      <input
        id="slug"
        formControlName="slug"
        placeholder="derived from the name"
      />
      <small>
        Part of the link participants share. Leave it empty and the name
        decides; changing it later breaks links that are already out there.
      </small>

      <label for="websiteUrl">Website</label>
      <input id="websiteUrl" type="url" formControlName="websiteUrl" />

      <label for="contactEmail">Contact e-mail address</label>
      <input id="contactEmail" type="email" formControlName="contactEmail" />

      <label for="status">Status</label>
      <select id="status" formControlName="status">
        @for (status of statuses; track status) {
          <option [value]="status">{{ status }}</option>
        }
      </select>
      <small>
        Only a published series is visible to participants — a draft is not.
      </small>

      <div class="actions">
        <button type="submit" [disabled]="busy()">
          {{ busy() ? 'Saving…' : 'Save' }}
        </button>
        <a routerLink="/">Cancel</a>
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
  protected readonly isNew = computed(() => !this.id());
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

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
      if (id) {
        await this.admin.update(id, payload);
      } else {
        await this.admin.create(payload);
      }
      await this.router.navigate(['/']);
    } catch (error: unknown) {
      this.error.set((error as ApiError)?.message ?? 'Saving failed.');
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
          ? 'This event series no longer exists.'
          : ((error as ApiError)?.message ?? 'Loading failed.'),
      );
    }
  }
}
