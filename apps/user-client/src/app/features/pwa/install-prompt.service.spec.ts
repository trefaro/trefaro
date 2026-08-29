import { TestBed } from '@angular/core/testing';
import { InstallPromptService } from './install-prompt.service';

/** The event Chromium fires; nothing standard exists to construct it. */
function beforeInstallPrompt(): Event & {
  prompt: ReturnType<typeof vi.fn>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  defaultPrevented: boolean;
} {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  return Object.assign(event, {
    prompt: vi.fn(async () => undefined),
    userChoice: Promise.resolve({ outcome: 'accepted' as const }),
  });
}

describe('InstallPromptService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => localStorage.clear());

  it('offers nothing until the browser says the application qualifies', () => {
    // Every browser on iOS and Firefox never fire this event. A hint there
    // would be an instruction nobody can follow from the page.
    expect(TestBed.inject(InstallPromptService).available()).toBe(false);
  });

  it('suppresses the browser own bar and offers in its place', () => {
    const service = TestBed.inject(InstallPromptService);
    const event = beforeInstallPrompt();

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(service.available()).toBe(true);
  });

  it('hands a click to the browser and spends the event', async () => {
    const service = TestBed.inject(InstallPromptService);
    const event = beforeInstallPrompt();
    window.dispatchEvent(event);

    await service.install();

    expect(event.prompt).toHaveBeenCalledTimes(1);
    // The event may be used once; a button that stayed would do nothing on the
    // second click, which looks broken rather than declined.
    expect(service.available()).toBe(false);
  });

  it('remembers a "not now" across visits', () => {
    const first = TestBed.inject(InstallPromptService);
    window.dispatchEvent(beforeInstallPrompt());
    first.dismiss();
    expect(first.available()).toBe(false);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const second = TestBed.inject(InstallPromptService);
    window.dispatchEvent(beforeInstallPrompt());

    expect(second.available()).toBe(false);
  });

  it('stops offering once the application is installed', () => {
    const service = TestBed.inject(InstallPromptService);
    window.dispatchEvent(beforeInstallPrompt());

    window.dispatchEvent(new Event('appinstalled'));

    expect(service.available()).toBe(false);
  });
});
