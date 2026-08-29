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
import type { BrandingImageKind, BrandingImages } from '@trefaro/shared-models';
import {
  BRANDING_MIME_TYPES,
  MAX_BRANDING_BYTES,
  brandingTypeSummary,
} from '@trefaro/shared-models';
import { ConfigAdminService } from '../../features/config/config-admin.service';

/** A chosen file and the local address its preview is drawn from. */
interface PendingImage {
  readonly file: File;
  readonly previewUrl: string;
}

/**
 * One of the two branding images: what is stored, what is about to replace it,
 * and the two buttons (FR 1.4, E19, E26).
 *
 * A component of its own rather than the same markup twice, because the two
 * images differ in exactly one interesting way — an app icon should be square
 * and a logo should not — and everything else about them is identical.
 *
 * Two decisions worth naming:
 *
 * 1. **Choosing a file does not upload it.** The preview is drawn from the local
 *    file first, and a second click sends it. That is not politeness: nothing on
 *    this side can check whether an icon is square (E26 rules out an image
 *    library on the server, and reading pixel dimensions here would be a second,
 *    weaker answer), so the only check that exists is an organizer looking at
 *    it. An upload is also *not* covered by the page's Discard — it is written
 *    the moment it is sent — and a two-step gesture is what makes that visible.
 * 2. **The type and size are checked here as well.** Not as a security measure:
 *    the server checks the first bytes and would refuse the same file (F38).
 *    It is so that a 4 MB export gets a sentence about what is allowed instead
 *    of a 413 after the bytes have travelled.
 */
@Component({
  selector: 'trefaro-branding-image-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    <section class="field">
      <h3>{{ heading() }}</h3>
      <p class="meta">{{ hint() }}</p>

      <div class="field__body">
        <div class="preview" [class.preview--square]="square()">
          @if (shownUrl(); as url) {
            <img [src]="url" [alt]="heading()" />
          } @else {
            <span class="preview__empty">
              {{ 'admin.design.noImage' | transloco }}
            </span>
          }
        </div>

        <div class="field__controls">
          <div class="file">
            <label [for]="inputId()">{{ fileLabel() }}</label>
            <input
              #picker
              [id]="inputId()"
              [attr.aria-describedby]="inputId() + '-hint'"
              type="file"
              [accept]="accept"
              [disabled]="busy()"
              (change)="choose($event)"
            />
          </div>
          <p class="meta" [id]="inputId() + '-hint'">{{ typeHint() }}</p>

          @if (pending(); as chosen) {
            <p class="meta" role="status">
              {{
                'admin.design.notUploaded'
                  | transloco: { name: chosen.file.name }
              }}
            </p>
            <div class="field__actions">
              <button type="button" [disabled]="busy()" (click)="upload()">
                {{ 'admin.design.upload' | transloco }}
              </button>
              <button type="button" [disabled]="busy()" (click)="discard()">
                {{ 'admin.design.keepCurrent' | transloco }}
              </button>
            </div>
          } @else if (currentUrl()) {
            <div class="field__actions">
              <button
                type="button"
                class="danger"
                [disabled]="busy()"
                (click)="remove()"
              >
                {{ 'admin.design.remove' | transloco }}
              </button>
            </div>
          }

          @if (error(); as problem) {
            <p class="error" role="alert">
              {{ problem.key | transloco: problem.params }}
              @if (problem.detail; as detail) {
                <span class="error__detail">{{ detail }}</span>
              }
            </p>
          }
        </div>
      </div>
    </section>
  `,
  styles: `
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    h3 {
      margin: 0;
      font-size: 1rem;
    }

    .field__body {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      align-items: start;
    }

    /* A chequerboard, so a transparent PNG is recognisable as transparent
       rather than as white — which is what it will not be on a dark home
       screen. */
    .preview {
      display: grid;
      place-items: center;
      inline-size: 12rem;
      block-size: 5rem;
      padding: 0.4rem;
      border: 1px solid color-mix(in oklab, currentColor 25%, transparent);
      border-radius: 0.5rem;
      background-color: #ffffff;
      background-image:
        linear-gradient(45deg, #e9e9e9 25%, transparent 25%),
        linear-gradient(-45deg, #e9e9e9 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #e9e9e9 75%),
        linear-gradient(-45deg, transparent 75%, #e9e9e9 75%);
      background-size: 12px 12px;
      background-position:
        0 0,
        0 6px,
        6px -6px,
        -6px 0;
    }

    .preview--square {
      inline-size: 5rem;
    }

    .preview img {
      max-inline-size: 100%;
      max-block-size: 100%;
    }

    .preview__empty {
      font-size: 0.8rem;
      color: #444;
    }

    .field__controls {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      min-inline-size: 16rem;
    }

    .file {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      font-size: 0.9rem;
    }

    .file label {
      font-weight: 600;
    }

    .field__actions {
      display: flex;
      gap: 0.6rem;
    }

    .meta {
      margin: 0;
      font-size: 0.85rem;
      color: #444;
    }

    .error {
      margin: 0;
      font-size: 0.9rem;
      color: #a3341f;
    }

    button {
      padding: 0.4rem 0.8rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      background: transparent;
      font: inherit;
      cursor: pointer;
    }

    .danger {
      color: #a3341f;
    }
  `,
})
export class BrandingImageField {
  readonly kind = input.required<BrandingImageKind>();
  readonly heading = input.required<string>();
  /**
   * The label of the file input.
   *
   * Given from outside rather than derived from {@link heading}, because both
   * fields are on the same page: two file inputs both called "Choose an image"
   * are two controls a screen reader announces identically.
   */
  readonly fileLabel = input.required<string>();
  readonly hint = input.required<string>();
  /** The stored image, as `/api/config` reports it; `null` while there is none. */
  readonly currentUrl = input.required<string | null>();
  /** Draws the preview frame square, for the image that lands on a home screen. */
  readonly square = input(false);

  /** What the server now stores, so the page can re-read its configuration. */
  readonly changed = output<BrandingImages>();

  /** Ties the label, the input and its hint together; unique per kind. */
  protected readonly inputId = computed(() => `branding-file-${this.kind()}`);

  protected readonly accept = BRANDING_MIME_TYPES.join(',');

  private readonly config = inject(ConfigAdminService);
  private readonly i18n = inject(TranslationService);

  /**
   * What may be uploaded, in one sentence.
   *
   * The format names stay as they are — PNG is PNG in every language — and only
   * the sentence around them is a key. A method rather than a field, so it is
   * re-read when the language changes (F72).
   */
  protected typeHint(): string {
    return this.i18n.translate('admin.design.typeHint', {
      types: brandingTypeSummary(),
      kilobytes: Math.round(MAX_BRANDING_BYTES / 1024),
    });
  }
  private readonly picker =
    viewChild.required<ElementRef<HTMLInputElement>>('picker');

  protected readonly pending = signal<PendingImage | null>(null);
  protected readonly error = signal<Problem | null>(null);
  protected readonly busy = signal(false);

  constructor() {
    // An object URL holds the file in memory until it is released, and this
    // component is reached by routing away and back.
    inject(DestroyRef).onDestroy(() => this.releasePreview());
  }

  /** The chosen file if there is one, otherwise what is stored. */
  protected shownUrl(): string | null {
    return this.pending()?.previewUrl ?? this.currentUrl();
  }

  protected choose(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.releasePreview();
    this.pending.set(null);
    this.error.set(null);
    if (!file) return;

    if (!BRANDING_MIME_TYPES.includes(file.type)) {
      // The type the operating system guessed, which is also what the server
      // will compare the first bytes against. Naming it makes a renamed file
      // understandable rather than mysterious — and a file whose type the
      // browser could not guess gets a sentence that names no type at all.
      this.error.set({
        key: file.type
          ? 'admin.design.typeRefused'
          : 'admin.design.typeRefusedUnknown',
        detail: null,
        params: { type: file.type, hint: this.typeHint() },
      });
      this.reset();
      return;
    }

    if (file.size > MAX_BRANDING_BYTES) {
      this.error.set({
        key: 'admin.design.tooLarge',
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

  protected async upload(): Promise<void> {
    const chosen = this.pending();
    if (!chosen) return;
    await this.write(() => this.config.uploadImage(this.kind(), chosen.file));
  }

  protected async remove(): Promise<void> {
    await this.write(() => this.config.removeImage(this.kind()));
  }

  /** Drops the chosen file and shows the stored image again. */
  protected discard(): void {
    this.releasePreview();
    this.pending.set(null);
    this.error.set(null);
    this.reset();
  }

  private async write(action: () => Promise<BrandingImages>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const images = await action();
      this.discard();
      this.changed.emit(images);
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'admin.design.errorImage'));
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
   * refused upload could not be retried after the file was corrected on disk.
   */
  private reset(): void {
    this.picker().nativeElement.value = '';
  }
}
