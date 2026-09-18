import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type Problem } from '@trefaro/shared-http';
import { MAX_PASSWORD_LENGTH } from '@trefaro/shared-models';
import { ParticipantSessionService } from '../auth/participant-session.service';
import { ParticipantProfileService } from './participant-profile.service';

/**
 * Downloading everything, and closing the account (E65, FR 4.3).
 *
 * Its own component under the profile form, for the reason the notification
 * switch has one: the profile form is about who somebody is, and these two are
 * about whether this instance holds them at all. Putting the delete button in
 * the same `<form>` as a name field is also how a stray Enter deletes an
 * account.
 *
 * **The deletion is two steps and the second one is a password**, the same
 * guard the password change has: whoever is holding this session may have found
 * the screen unlocked, and this is the one thing a session can do that cannot
 * be taken back. What it does is spelled out before the button rather than
 * after it — three sentences, one per category, because what happens to a
 * conversation is not what happens to an account.
 */
@Component({
  selector: 'trefaro-my-data',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoPipe],
  template: `
    <section class="panel">
      <h2>{{ 'profile.myData.heading' | transloco }}</h2>
      <p class="hint">{{ 'profile.myData.lead' | transloco }}</p>

      <p class="hint">{{ 'profile.myData.export.lead' | transloco }}</p>
      @if (exportError(); as problem) {
        <p class="notice" role="alert">
          {{ problem.key | transloco }}
          @if (problem.reason; as reason) {
            <span class="notice__detail">{{
              reason.code | transloco: reason.params
            }}</span>
          }
        </p>
      }
      <div class="actions">
        <button type="button" [disabled]="exporting()" (click)="download()">
          {{
            (exporting()
              ? 'profile.myData.export.working'
              : 'profile.myData.export.action'
            ) | transloco
          }}
        </button>
      </div>

      <h3>{{ 'profile.myData.delete.heading' | transloco }}</h3>
      <p class="hint">{{ 'profile.myData.delete.lead' | transloco }}</p>
      <ul class="consequences">
        <li>{{ 'profile.myData.delete.goes' | transloco }}</li>
        <li>{{ 'profile.myData.delete.stays' | transloco }}</li>
        <li>{{ 'profile.myData.delete.unnamed' | transloco }}</li>
      </ul>

      @if (deleteError(); as problem) {
        <p class="notice" role="alert">
          {{ problem.key | transloco }}
          @if (problem.reason; as reason) {
            <span class="notice__detail">{{
              reason.code | transloco: reason.params
            }}</span>
          }
        </p>
      }

      @if (confirming()) {
        <form [formGroup]="form" (ngSubmit)="remove()" novalidate>
          <fieldset [disabled]="deleting()">
            <label>
              <span>{{ 'profile.myData.delete.password' | transloco }}</span>
              <input
                formControlName="password"
                type="password"
                autocomplete="current-password"
              />
            </label>
            <div class="actions">
              <button type="submit" class="danger">
                {{
                  (deleting()
                    ? 'profile.myData.delete.working'
                    : 'profile.myData.delete.confirm'
                  ) | transloco
                }}
              </button>
              <button type="button" (click)="cancel()">
                {{ 'profile.myData.delete.cancel' | transloco }}
              </button>
            </div>
          </fieldset>
        </form>
      } @else {
        <div class="actions">
          <button type="button" class="danger" (click)="confirming.set(true)">
            {{ 'profile.myData.delete.start' | transloco }}
          </button>
        </div>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .panel {
      padding-block-start: 1.5rem;
      border-block-start: 1px solid var(--trefaro-border, rgba(0, 0, 0, 0.12));
    }

    h2,
    h3 {
      margin-block: 0 0.4rem;
      font-size: 1.05rem;
    }

    h3 {
      margin-block-start: 2rem;
    }

    .hint {
      margin-block: 0 0.8rem;
      color: var(--trefaro-muted, #555);
      font-size: 0.9rem;
    }

    .consequences {
      margin-block: 0 1rem;
      padding-inline-start: 1.2rem;
      color: var(--trefaro-muted, #555);
      font-size: 0.9rem;
    }

    .consequences li {
      margin-block-end: 0.3rem;
    }

    fieldset {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      margin: 0;
      padding: 0;
      border: 0;
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      font-size: 0.9rem;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
      align-items: center;
    }

    .danger {
      background: var(--trefaro-danger, #a4262c);
      color: #fff;
    }

    .notice {
      margin-block: 0 0.8rem;
      padding: 0.6rem 0.8rem;
      border-radius: 0.4rem;
      background: rgba(164, 38, 44, 0.1);
      font-size: 0.9rem;
    }

    .notice__detail {
      display: block;
      opacity: 0.85;
    }
  `,
})
export class MyData {
  private readonly profiles = inject(ParticipantProfileService);
  private readonly session = inject(ParticipantSessionService);
  private readonly router = inject(Router);
  private readonly builder = inject(FormBuilder);

  protected readonly exporting = signal(false);
  protected readonly exportError = signal<Problem | null>(null);
  protected readonly confirming = signal(false);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<Problem | null>(null);

  protected readonly form = this.builder.nonNullable.group({
    password: [
      '',
      [Validators.required, Validators.maxLength(MAX_PASSWORD_LENGTH)],
    ],
  });

  protected async download(): Promise<void> {
    this.exporting.set(true);
    this.exportError.set(null);
    try {
      this.offer(await this.profiles.exportArchive());
    } catch (error) {
      this.exportError.set(problemOf(error, 'profile.myData.export.failed'));
    } finally {
      this.exporting.set(false);
    }
  }

  protected async remove(): Promise<void> {
    if (this.form.invalid) return;

    this.deleting.set(true);
    this.deleteError.set(null);
    try {
      await this.profiles.deleteAccount(this.form.getRawValue());
      // The server already cleared the cookie and the rows; this is what this
      // browser still believes. Not `logOut()`: there is no session left to
      // end, and the call would answer 401 into an empty page.
      this.session.clear();
      await this.router.navigate(['/']);
    } catch (error) {
      this.deleteError.set(problemOf(error, 'profile.myData.delete.failed'));
      this.deleting.set(false);
    }
  }

  protected cancel(): void {
    this.form.reset();
    this.deleteError.set(null);
    this.confirming.set(false);
  }

  /**
   * Hands the archive to the browser under a name.
   *
   * The same temporary anchor the organizer's attachment download uses: there
   * is no other way to name a file that arrived as a fetched response, and the
   * object URL is released a moment later because releasing it in the same
   * tick cancels the download in some browsers.
   */
  private offer(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trefaro-export-${new Date().toISOString().slice(0, 10)}.zip`;
    link.rel = 'noopener';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
