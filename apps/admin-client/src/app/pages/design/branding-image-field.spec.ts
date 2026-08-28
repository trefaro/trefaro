import { TestBed } from '@angular/core/testing';
import type { BrandingImageKind, BrandingImages } from '@trefaro/shared-models';
import { MAX_BRANDING_BYTES } from '@trefaro/shared-models';
import { ConfigAdminService } from '../../features/config/config-admin.service';
import { BrandingImageField } from './branding-image-field';

const IMAGES: BrandingImages = {
  logoUrl: '/api/media/branding/logo?v=42',
  appIconUrl: null,
};

/** The template drives protected members; the tests reach them the same way. */
interface FieldInternals {
  choose: (event: Event) => void;
  upload: () => Promise<void>;
  remove: () => Promise<void>;
  discard: () => void;
  pending: () => { file: File } | null;
  error: () => string | null;
}

class FakeConfigAdminService {
  readonly uploaded: { kind: BrandingImageKind; file: File }[] = [];
  readonly removed: BrandingImageKind[] = [];
  failWith: unknown = null;

  uploadImage(kind: BrandingImageKind, file: File): Promise<BrandingImages> {
    if (this.failWith) return Promise.reject(this.failWith);
    this.uploaded.push({ kind, file });
    return Promise.resolve(IMAGES);
  }

  removeImage(kind: BrandingImageKind): Promise<BrandingImages> {
    this.removed.push(kind);
    return Promise.resolve({ logoUrl: null, appIconUrl: null });
  }
}

/**
 * A file input carrying one file.
 *
 * Built by hand rather than through a real `<input>`: `files` is read-only in the
 * DOM and only a user gesture fills it, so a test that wanted to click a picker
 * could not exist. What is under test is what happens *after* the choice.
 */
function chooseEvent(file: File | null): Event {
  const input = document.createElement('input');
  input.type = 'file';
  Object.defineProperty(input, 'files', {
    value: file ? [file] : [],
    configurable: true,
  });
  const event = new Event('change');
  Object.defineProperty(event, 'target', { value: input, configurable: true });
  return event;
}

function file(options: { name?: string; type: string; size?: number }): File {
  const bytes = new Uint8Array(options.size ?? 8);
  return new File([bytes], options.name ?? 'logo.png', { type: options.type });
}

describe('BrandingImageField', () => {
  let admin: FakeConfigAdminService;

  function render(kind: BrandingImageKind = 'logo') {
    admin = new FakeConfigAdminService();
    TestBed.configureTestingModule({
      providers: [{ provide: ConfigAdminService, useValue: admin }],
    });
    const fixture = TestBed.createComponent(BrandingImageField);
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('heading', 'Logo');
    fixture.componentRef.setInput('fileLabel', 'Choose a logo file');
    fixture.componentRef.setInput('hint', 'Shown in the header.');
    fixture.componentRef.setInput('currentUrl', '/api/media/branding/logo?v=1');
    fixture.detectChanges();

    const emitted: BrandingImages[] = [];
    fixture.componentInstance.changed.subscribe((images) =>
      emitted.push(images),
    );

    return {
      fixture,
      emitted,
      field: fixture.componentInstance as unknown as FieldInternals,
      text: () => (fixture.nativeElement as HTMLElement).textContent ?? '',
    };
  }

  it('shows a chosen file without uploading it', async () => {
    const { fixture, field, text } = render();

    field.choose(chooseEvent(file({ type: 'image/png', name: 'brand.png' })));
    fixture.detectChanges();

    expect(field.pending()?.file.name).toBe('brand.png');
    expect(text()).toContain('not uploaded yet');
    // The whole point of the two-step gesture: nothing is written until Upload.
    expect(admin.uploaded).toEqual([]);
  });

  it('sends the file when Upload is pressed and reports the new URLs', async () => {
    const { fixture, field, emitted } = render();
    field.choose(chooseEvent(file({ type: 'image/webp' })));
    fixture.detectChanges();

    await field.upload();
    fixture.detectChanges();

    expect(admin.uploaded).toHaveLength(1);
    expect(admin.uploaded[0].kind).toBe('logo');
    expect(emitted).toEqual([IMAGES]);
    // The choice is spent; the stored image is what is shown again.
    expect(field.pending()).toBeNull();
  });

  it('refuses a type the instance does not serve, before it travels', () => {
    const { fixture, field } = render();

    field.choose(chooseEvent(file({ type: 'image/svg+xml', name: 'l.svg' })));
    fixture.detectChanges();

    // No SVG: it can carry script and would be served from this origin.
    expect(field.error()).toContain('image/svg+xml');
    expect(field.pending()).toBeNull();
    expect(admin.uploaded).toEqual([]);
  });

  it('refuses an image above the limit rather than waiting for a 413', () => {
    const { fixture, field } = render();

    field.choose(
      chooseEvent(file({ type: 'image/png', size: MAX_BRANDING_BYTES + 1 })),
    );
    fixture.detectChanges();

    expect(field.error()).toContain('KB');
    expect(field.pending()).toBeNull();
    expect(admin.uploaded).toEqual([]);
  });

  it('does nothing when the picker was cancelled', () => {
    const { fixture, field } = render();

    field.choose(chooseEvent(null));
    fixture.detectChanges();

    expect(field.error()).toBeNull();
    expect(field.pending()).toBeNull();
  });

  it('keeps the current image when the choice is discarded', () => {
    const { fixture, field } = render();
    field.choose(chooseEvent(file({ type: 'image/png' })));
    fixture.detectChanges();

    field.discard();
    fixture.detectChanges();

    expect(field.pending()).toBeNull();
    expect(admin.uploaded).toEqual([]);
  });

  it('removes the stored image and reports that nothing is left', async () => {
    const { fixture, field, emitted } = render('app-icon');

    await field.remove();
    fixture.detectChanges();

    expect(admin.removed).toEqual(['app-icon']);
    expect(emitted).toEqual([{ logoUrl: null, appIconUrl: null }]);
  });

  it('keeps the chosen file when the upload is refused', async () => {
    const { fixture, field, emitted } = render();
    admin.failWith = { status: 400, message: 'Those bytes are not a PNG.' };
    field.choose(chooseEvent(file({ type: 'image/png' })));
    fixture.detectChanges();

    await field.upload();
    fixture.detectChanges();

    expect(field.error()).toBe('Those bytes are not a PNG.');
    expect(emitted).toEqual([]);
  });
});
