import { TestBed } from '@angular/core/testing';
import { provideTranslationsForTest } from '@trefaro/shared-i18n';
import { InstallHint } from './install-hint';
import { InstallPromptService } from './install-prompt.service';

const CATALOGUE = {
  'app.install.title': 'Install this app',
  'app.install.body': 'Add this app to your home screen.',
  'app.install.action': 'Install',
  'app.install.dismiss': 'Not now',
};

describe('InstallHint', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideTranslationsForTest(CATALOGUE)],
    });
  });

  afterEach(() => localStorage.clear());

  it('shows nothing where the browser has not offered an installation', () => {
    const fixture = TestBed.createComponent(InstallHint);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it('offers once the browser has, and asks again never after a "not now"', () => {
    const service = TestBed.inject(InstallPromptService);
    const fixture = TestBed.createComponent(InstallHint);
    const event = Object.assign(
      new Event('beforeinstallprompt', { cancelable: true }),
      { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'accepted' }) },
    );

    window.dispatchEvent(event);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Install this app');

    const dismiss: HTMLButtonElement =
      fixture.nativeElement.querySelector('.install__dismiss');
    dismiss.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('');
    expect(service.available()).toBe(false);
  });
});
