import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  TranslationService,
  provideTranslationsForTest,
} from '@trefaro/shared-i18n';
import { MAX_BRANDING_BYTES, type AvatarImage } from '@trefaro/shared-models';
import type { Problem } from '@trefaro/shared-http';
import { AvatarField } from './avatar-field';
import { ParticipantProfileService } from './participant-profile.service';

/** The template drives protected members; the tests reach them the same way. */
interface FieldInternals {
  choose: (event: Event) => void;
  save: () => Promise<void>;
  remove: () => Promise<void>;
  discard: () => void;
  pending: () => { file: File } | null;
  error: () => Problem | null;
  initials: () => string;
}

class FakeProfiles {
  readonly uploaded: File[] = [];
  removals = 0;
  nextUrl: string | null = '/api/media/profiles/profile-1/avatar?v=7';

  async uploadAvatar(file: File): Promise<AvatarImage> {
    this.uploaded.push(file);
    return { avatarUrl: this.nextUrl };
  }

  async removeAvatar(): Promise<AvatarImage> {
    this.removals += 1;
    return { avatarUrl: null };
  }
}

/**
 * A file input carrying one file.
 *
 * Built by hand rather than through a real `<input>`: `files` is read-only in
 * the DOM and only a user gesture fills it, so what is under test is what
 * happens *after* the choice.
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
  return new File([bytes], options.name ?? 'me.png', { type: options.type });
}

describe('AvatarField', () => {
  let profiles: FakeProfiles;

  function render(currentUrl: string | null = null) {
    profiles = new FakeProfiles();
    TestBed.configureTestingModule({
      providers: [
        provideTranslationsForTest({
          'profile.avatar.notSaved': '{{name}} — not saved yet.',
          'profile.avatar.typeHint': '{{types}}, at most {{kilobytes}} KB.',
          'profile.avatar.typeRefused': '{{type}} cannot be used. {{hint}}',
          'profile.avatar.tooLarge':
            'That picture is {{kilobytes}} KB. {{hint}}',
        }),
        { provide: ParticipantProfileService, useValue: profiles },
        {
          provide: TranslationService,
          useValue: {
            locale: signal('en'),
            // Non-reactive on purpose, exactly like the real one: a fake that
            // re-read the catalogue by itself would hide F72.
            translate: (key: string, params?: Record<string, unknown>) =>
              key === 'profile.avatar.typeHint'
                ? `${params?.['types']}, at most ${params?.['kilobytes']} KB.`
                : key,
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(AvatarField);
    fixture.componentRef.setInput('currentUrl', currentUrl);
    fixture.componentRef.setInput('firstName', 'Amina');
    fixture.componentRef.setInput('lastName', 'Okonkwo');
    fixture.detectChanges();

    const changes: (string | null)[] = [];
    fixture.componentInstance.changed.subscribe((url) => changes.push(url));

    return {
      fixture,
      changes,
      field: fixture.componentInstance as unknown as FieldInternals,
      host: fixture.nativeElement as HTMLElement,
      text: () => (fixture.nativeElement as HTMLElement).textContent ?? '',
    };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('stands in for a missing picture with the initials', () => {
    const { field, host } = render();

    expect(field.initials()).toBe('AO');
    expect(host.querySelector('img')).toBeNull();
    // Decorative: the name is on the page already.
    expect(
      host.querySelector('.preview__initials')?.getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('shows a chosen picture without saving it', () => {
    const { fixture, field, text } = render();

    field.choose(chooseEvent(file({ type: 'image/png', name: 'me.png' })));
    fixture.detectChanges();

    expect(field.pending()?.file.name).toBe('me.png');
    expect(text()).toContain('not saved yet');
    // The whole point of the two-step gesture: nothing is written yet.
    expect(profiles.uploaded).toEqual([]);
  });

  it('sends the picture and reports the URL it now has', async () => {
    const { fixture, field, changes } = render();
    field.choose(chooseEvent(file({ type: 'image/webp' })));
    fixture.detectChanges();

    await field.save();

    expect(profiles.uploaded).toHaveLength(1);
    expect(changes).toEqual(['/api/media/profiles/profile-1/avatar?v=7']);
    expect(field.pending()).toBeNull();
  });

  it('refuses a type the server would refuse, naming what is allowed', () => {
    const { fixture, field } = render();

    field.choose(chooseEvent(file({ type: 'image/svg+xml' })));
    fixture.detectChanges();

    expect(field.error()?.key).toBe('profile.avatar.typeRefused');
    expect(field.error()?.params?.['type']).toBe('image/svg+xml');
    expect(field.pending()).toBeNull();
  });

  it('says nothing about a type when the browser guessed none', () => {
    const { field } = render();

    field.choose(chooseEvent(file({ type: '' })));

    expect(field.error()?.key).toBe('profile.avatar.typeRefusedUnknown');
  });

  it('refuses a picture above the limit before it travels', () => {
    const { field } = render();

    field.choose(
      chooseEvent(file({ type: 'image/png', size: MAX_BRANDING_BYTES + 1 })),
    );

    expect(field.error()?.key).toBe('profile.avatar.tooLarge');
    expect(profiles.uploaded).toEqual([]);
  });

  it('removes the stored picture and reports that there is none', async () => {
    const { field, changes } = render('/api/media/profiles/profile-1/avatar');

    await field.remove();

    expect(profiles.removals).toBe(1);
    expect(changes).toEqual([null]);
  });

  it('gives up a chosen picture without touching the stored one', () => {
    const { fixture, field, changes } = render('/api/media/profiles/p/avatar');
    field.choose(chooseEvent(file({ type: 'image/png' })));
    fixture.detectChanges();

    field.discard();

    expect(field.pending()).toBeNull();
    expect(profiles.uploaded).toEqual([]);
    expect(changes).toEqual([]);
  });
});
