import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import {
  BRANDING_MIME_TYPES,
  MAX_BRANDING_BYTES,
  brandingTypeSummary,
} from '@trefaro/shared-models';
import { initialsOf } from './initials';
import { ParticipantProfileService } from './participant-profile.service';

/** A chosen file and the local address its preview is drawn from. */
interface PendingPicture {
  readonly file: File;
  readonly previewUrl: string;
}

/**
 * The profile picture, its two buttons and the initials that stand in for it
 * (FR 4.3).
 *
 * Deliberately not the organizer client's `ImageUploadField`, and the reason is
 * structural rather than a matter of taste: Nx keeps the two applications apart,
 * so sharing that component would mean a shared *component* library — and the
 * list of shared libraries comes from the thesis' architecture (HTTP,
 * configuration, models, plug-ins, i18n), not from this work package. What the
 * two do share is written down instead: the local type and size check exists
 * for the same reason in both places, and the server checks the first bytes
 * regardless (F38). The candidate for extraction is recorded in `todo.md`.
 *
 * Two decisions this component makes on its own:
 *
 * 1. **Choosing a file does not upload it.** A picture of a person is more
 *    personal than an organization's logo, and the preview is the only chance
 *    to see what everybody else will see before they do. It is also written the
 *    moment it is sent — it is not part of the profile form and not covered by
 *    leaving that form — and a two-step gesture is what makes that visible.
 * 2. **No picture is not an empty frame.** The initials from the name stand in,
 *    which is what a profile without a picture looks like everywhere else in
 *    this application (and in AP 5's search, once it exists).
 */
@Component({
  selector: 'trefaro-avatar-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    <!-- Named, because a section without an accessible name is not a region:
         a screen reader would announce an unlabelled group, and the picture,
         the picker and its two buttons belong together. -->
    <section class="avatar" aria-labelledby="avatar-heading">
      <h2 id="avatar-heading">{{ 'profile.avatar.heading' | transloco }}</h2>

      <div class="avatar__body">
        <div class="preview">
          @if (shownUrl(); as url) {
            <img [src]="url" [alt]="'profile.avatar.alt' | transloco" />
          } @else {
            <!-- Decorative: the name is on the page already, and a screen
                 reader reading two letters of it again says nothing new. -->
            <span class="preview__initials" aria-hidden="true">
              {{ initials() }}
            </span>
          }
        </div>

        <div class="avatar__controls">
          <div class="file">
            <label for="avatar-file">
              {{ 'profile.avatar.choose' | transloco }}
            </label>
            <input
              #picker
              id="avatar-file"
              aria-describedby="avatar-file-hint"
              type="file"
              [accept]="accept"
              [disabled]="busy()"
              (change)="choose($event)"
            />
          </div>
          <p class="hint" id="avatar-file-hint">{{ typeHint() }}</p>

          @if (pending(); as chosen) {
            <p class="hint" role="status">
              {{
                'profile.avatar.notSaved'
                  | transloco: { name: chosen.file.name }
              }}
            </p>
            <div class="avatar__actions">
              <button type="button" [disabled]="busy()" (click)="save()">
                {{ 'profile.avatar.save' | transloco }}
              </button>
              <button type="button" [disabled]="busy()" (click)="discard()">
                {{ 'profile.avatar.keepCurrent' | transloco }}
              </button>
            </div>
          } @else if (currentUrl()) {
            <div class="avatar__actions">
              <button
                type="button"
                class="danger"
                [disabled]="busy()"
                (click)="remove()"
              >
                {{ 'profile.avatar.remove' | transloco }}
              </button>
            </div>
          }

          @if (error(); as problem) {
            <p class="notice" role="alert">
              {{ problem.key | transloco: problem.params }}
              @if (problem.detail; as detail) {
                <span class="notice__detail">{{ detail }}</span>
              }
            </p>
          }
        </div>
      </div>
    </section>
  `,
  styles: `
    .avatar {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    h2 {
      margin: 0;
      font-size: 1.1rem;
    }

    .avatar__body {
      display: flex;
      gap: 1rem;
      align-items: start;
      flex-wrap: wrap;
    }

    .preview {
      display: grid;
      place-items: center;
      inline-size: 5.5rem;
      block-size: 5.5rem;
      border-radius: 50%;
      overflow: hidden;
      background: var(--trefaro-color-primary-soft);
      color: var(--trefaro-color-primary-strong);
    }

    .preview img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
    }

    .preview__initials {
      font-size: 1.6rem;
      font-weight: 600;
    }

    .avatar__controls {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      min-inline-size: 14rem;
      flex: 1;
    }

    .file {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .file label {
      font-weight: 600;
    }

    .avatar__actions {
      display: flex;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    button {
      padding: 0.5rem 0.9rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      background: transparent;
      color: inherit;
      font: inherit;
    }

    button:disabled {
      opacity: 0.55;
    }

    .danger {
      color: var(--trefaro-color-primary-strong);
    }

    .hint {
      margin: 0;
      color: color-mix(in oklab, currentColor 70%, transparent);
      font-size: 0.9rem;
    }

    .notice {
      margin: 0;
      color: var(--trefaro-color-primary-strong);
    }
  `,
})
export class AvatarField {
  /** The stored picture, as the profile reports it; `null` while there is none. */
  readonly currentUrl = input.required<string | null>();
  /** For the stand-in when there is no picture. */
  readonly firstName = input.required<string>();
  readonly lastName = input.required<string>();

  /**
   * The picture as it now stands, after a save or a removal.
   *
   * With a payload, unlike the organizer client's field: the answer here *is*
   * everything that changed, so re-reading the whole profile would be a request
   * that learns nothing.
   */
  readonly changed = output<string | null>();

  protected readonly accept = BRANDING_MIME_TYPES.join(',');

  private readonly profiles = inject(ParticipantProfileService);
  private readonly i18n = inject(TranslationService);
  private readonly picker =
    viewChild.required<ElementRef<HTMLInputElement>>('picker');

  protected readonly pending = signal<PendingPicture | null>(null);
  protected readonly error = signal<Problem | null>(null);
  protected readonly busy = signal(false);

  /**
   * The stand-in for a missing picture.
   *
   * The first letter of each name, upper-cased by the locale of the reader:
   * `toLocaleUpperCase` because a Turkish "i" is not an "I", and a stand-in
   * that misspells somebody's initial is worse than a blank circle.
   */
  protected readonly initials = computed(() =>
    initialsOf([this.firstName(), this.lastName()], this.i18n.locale()),
  );

  constructor() {
    // An object URL holds the file in memory until it is released, and this
    // page is reached by routing away and back.
    inject(DestroyRef).onDestroy(() => this.releasePreview());
  }

  /** The chosen file if there is one, otherwise what is stored. */
  protected shownUrl(): string | null {
    return this.pending()?.previewUrl ?? this.currentUrl();
  }

  /**
   * What may be uploaded, in one sentence.
   *
   * A method rather than a field, so it is re-read after a language change
   * (F72). The format names stay as they are — PNG is PNG in every language.
   */
  protected typeHint(): string {
    return this.i18n.translate('profile.avatar.typeHint', {
      types: brandingTypeSummary(),
      kilobytes: Math.round(MAX_BRANDING_BYTES / 1024),
    });
  }

  /**
   * Takes the picked file, or says why it cannot be sent.
   *
   * Checked here as a courtesy: the server checks the type against the file's
   * own first bytes and would refuse the same file (F38). The point of doing it
   * twice is that somebody on a phone learns about a 12-megapixel photo before
   * uploading it over mobile data.
   */
  protected choose(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    this.releasePreview();
    this.pending.set(null);
    this.error.set(null);
    if (!file) return;

    if (!BRANDING_MIME_TYPES.includes(file.type)) {
      this.error.set({
        // A file whose type the browser could not guess gets a sentence that
        // names no type at all.
        key: file.type
          ? 'profile.avatar.typeRefused'
          : 'profile.avatar.typeRefusedUnknown',
        detail: null,
        params: { type: file.type, hint: this.typeHint() },
      });
      this.reset();
      return;
    }

    if (file.size > MAX_BRANDING_BYTES) {
      this.error.set({
        key: 'profile.avatar.tooLarge',
        detail: null,
        params: {
          kilobytes: Math.round(file.size / 1024),
          hint: this.typeHint(),
        },
      });
      this.reset();
      return;
    }

    this.pending.set({ file, previewUrl: URL.createObjectURL(file) });
  }

  protected async save(): Promise<void> {
    const chosen = this.pending();
    if (!chosen) return;
    await this.write(() => this.profiles.uploadAvatar(chosen.file));
  }

  protected async remove(): Promise<void> {
    await this.write(() => this.profiles.removeAvatar());
  }

  /** Drops the chosen file and shows the stored picture again. */
  protected discard(): void {
    this.releasePreview();
    this.pending.set(null);
    this.error.set(null);
    this.reset();
  }

  private async write(
    action: () => Promise<{ readonly avatarUrl: string | null }>,
  ): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const { avatarUrl } = await action();
      this.discard();
      this.changed.emit(avatarUrl);
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'profile.avatar.failed'));
    } finally {
      this.busy.set(false);
    }
  }

  private releasePreview(): void {
    const chosen = this.pending();
    if (chosen) URL.revokeObjectURL(chosen.previewUrl);
  }

  /**
   * Empties the file input.
   *
   * Without it, choosing the same file again fires no `change` event — so a
   * refused picture could not be retried after being resized on the phone.
   */
  private reset(): void {
    this.picker().nativeElement.value = '';
  }
}
