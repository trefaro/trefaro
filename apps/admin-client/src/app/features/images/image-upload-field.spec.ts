import { TestBed } from '@angular/core/testing';
import type { Problem } from '@trefaro/shared-http';
import { provideTranslationsForTest } from '@trefaro/shared-i18n';
import { MAX_BRANDING_BYTES } from '@trefaro/shared-models';
import { ImageUploadField, type ImageEndpoint } from './image-upload-field';

/** The template drives protected members; the tests reach them the same way. */
interface FieldInternals {
  choose: (event: Event) => void;
  upload: () => Promise<void>;
  remove: () => Promise<void>;
  discard: () => void;
  pending: () => { file: File } | null;
  error: () => Problem | null;
}

/**
 * Whatever endpoint the caller wired up, as this component sees it.
 *
 * The component is deliberately ignorant of which one it is — the design page
 * hands it the configuration, the series form hands it a series — so the fake is
 * a recorder rather than a stand-in for a particular service.
 */
class FakeEndpoint implements ImageEndpoint {
  readonly uploaded: File[] = [];
  removals = 0;
  failWith: unknown = null;

  async upload(file: File): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.uploaded.push(file);
  }

  async remove(): Promise<void> {
    this.removals += 1;
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

describe('ImageUploadField', () => {
  let admin: FakeEndpoint;

  function render(fieldId = 'logo') {
    admin = new FakeEndpoint();
    TestBed.configureTestingModule({
      providers: [
        provideTranslationsForTest({
          'admin.design.notUploaded': '{{name}} — not uploaded yet.',
          'admin.design.typeHint': '{{types}}, at most {{kilobytes}} KB.',
          'admin.design.typeRefused':
            '{{type}} cannot be used. Allowed: {{hint}}',
          'admin.design.tooLarge': 'That image is {{kilobytes}} KB. {{hint}}',
        }),
      ],
    });
    const fixture = TestBed.createComponent(ImageUploadField);
    fixture.componentRef.setInput('fieldId', fieldId);
    fixture.componentRef.setInput('endpoint', admin);
    fixture.componentRef.setInput('heading', 'Logo');
    fixture.componentRef.setInput('fileLabel', 'Choose a logo file');
    fixture.componentRef.setInput('hint', 'Shown in the header.');
    fixture.componentRef.setInput('currentUrl', '/api/media/branding/logo?v=1');
    fixture.detectChanges();

    let changes = 0;
    fixture.componentInstance.changed.subscribe(() => (changes += 1));

    return {
      fixture,
      changed: () => changes,
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

  it('sends the file when Upload is pressed and says something changed', async () => {
    const { fixture, field, changed } = render();
    field.choose(chooseEvent(file({ type: 'image/webp' })));
    fixture.detectChanges();

    await field.upload();
    fixture.detectChanges();

    expect(admin.uploaded).toHaveLength(1);
    expect(changed()).toBe(1);
    // The choice is spent; the stored image is what is shown again.
    expect(field.pending()).toBeNull();
  });

  it('refuses a type the instance does not serve, before it travels', () => {
    const { fixture, field } = render();

    field.choose(chooseEvent(file({ type: 'image/svg+xml', name: 'l.svg' })));
    fixture.detectChanges();

    // No SVG: it can carry script and would be served from this origin. The
    // refused type travels as a parameter, so the key alone would not show it.
    expect(field.error()?.key).toBe('admin.design.typeRefused');
    expect(field.error()?.params?.['type']).toBe('image/svg+xml');
    expect(field.pending()).toBeNull();
    expect(admin.uploaded).toEqual([]);
  });

  it('refuses an image above the limit rather than waiting for a 413', () => {
    const { fixture, field } = render();

    field.choose(
      chooseEvent(file({ type: 'image/png', size: MAX_BRANDING_BYTES + 1 })),
    );
    fixture.detectChanges();

    expect(field.error()?.key).toBe('admin.design.tooLarge');
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

  it('removes the stored image and says something changed', async () => {
    const { fixture, field, changed } = render('app-icon');

    await field.remove();
    fixture.detectChanges();

    expect(admin.removals).toBe(1);
    expect(changed()).toBe(1);
  });

  it('keeps the chosen file when the upload is refused', async () => {
    const { fixture, field, changed } = render();
    admin.failWith = {
      status: 400,
      message: 'Those bytes are not a PNG.',
      explained: true,
    };
    field.choose(chooseEvent(file({ type: 'image/png' })));
    fixture.detectChanges();

    await field.upload();
    fixture.detectChanges();

    // This client's sentence, and the server's reason beside it (F77).
    expect(field.error()?.key).toBe('admin.design.errorImage');
    expect(field.error()?.detail).toBe('Those bytes are not a PNG.');
    expect(changed()).toBe(0);
  });
});
