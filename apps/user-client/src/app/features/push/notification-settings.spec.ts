import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslationsForTest } from '@trefaro/shared-i18n';
import { NotificationSettings } from './notification-settings';
import {
  PushSubscriptionService,
  type PushState,
} from './push-subscription.service';

const CATALOGUE = {
  'push.settings.title': 'Notifications on this device',
  'push.settings.lead': 'Changes to an event, and messages written to you.',
  'push.settings.on': 'This device is receiving notifications.',
  'push.settings.off': 'This device is not receiving notifications.',
  'push.settings.enable': 'Turn on',
  'push.settings.disable': 'Turn off',
  'push.settings.working': 'Asking your browser…',
  'push.blocked': 'This browser is blocking notifications for this site.',
  'push.unsupported': 'This browser cannot show notifications.',
  'push.installFirst': 'On an iPhone, add this app to the home screen first.',
  'push.failed': 'That did not work: {{reason}}',
};

class FakePush {
  readonly current = signal<PushState>('unsubscribed');
  readonly state = this.current.asReadonly();
  readonly failure = signal<string | null>(null);
  readonly error = this.failure.asReadonly();
  subscribed = 0;
  unsubscribed = 0;

  async subscribe(): Promise<void> {
    this.subscribed += 1;
  }

  async unsubscribe(): Promise<void> {
    this.unsubscribed += 1;
  }
}

/**
 * The switch, and the sentences that explain why there is none.
 *
 * The iOS line is the one that earns this component: an installed PWA is the
 * only place Web Push works there (F7), and a browser that simply renders
 * nothing would leave the case the whole decision depends on looking broken.
 */
describe('NotificationSettings', () => {
  let push: FakePush;

  function render() {
    push = new FakePush();
    TestBed.configureTestingModule({
      providers: [
        provideTranslationsForTest(CATALOGUE),
        { provide: PushSubscriptionService, useValue: push },
      ],
    });
    const fixture = TestBed.createComponent(NotificationSettings);
    fixture.detectChanges();
    return fixture;
  }

  it('offers to turn notifications on, and says what they are', () => {
    const fixture = render();

    expect(fixture.nativeElement.textContent).toContain(
      'Notifications on this device',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'messages written to you',
    );
    expect(fixture.nativeElement.textContent).toContain('Turn on');
  });

  it('turns them on when asked', () => {
    const fixture = render();

    fixture.nativeElement
      .querySelector('button')
      .dispatchEvent(new Event('click'));

    expect(push.subscribed).toBe(1);
  });

  it('offers to turn them off again once they are on', () => {
    const fixture = render();
    push.current.set('subscribed');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'This device is receiving notifications',
    );
    fixture.nativeElement
      .querySelector('button')
      .dispatchEvent(new Event('click'));

    expect(push.unsubscribed).toBe(1);
    expect(push.subscribed).toBe(0);
  });

  it('says the browser is asking while it is', () => {
    const fixture = render();
    push.current.set('subscribing');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button');
    expect(button.textContent).toContain('Asking your browser');
    expect(button.disabled).toBe(true);
  });

  it('explains a refusal it cannot undo, and offers no button', () => {
    const fixture = render();
    push.current.set('denied');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'blocking notifications',
    );
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('tells an iPhone what is missing rather than saying nothing (F7)', () => {
    const fixture = render();
    push.current.set('unsupported');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'cannot show notifications',
    );
    expect(fixture.nativeElement.textContent).toContain('home screen first');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('shows nothing at all where the instance does not do push', () => {
    const fixture = render();
    push.current.set('not-configured');
    fixture.detectChanges();

    // An off switch for something that cannot happen is worse than silence.
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it('repeats what went wrong, in the reader’s language', () => {
    const fixture = render();
    push.failure.set('push service unreachable');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'That did not work: push service unreachable',
    );
  });
});
