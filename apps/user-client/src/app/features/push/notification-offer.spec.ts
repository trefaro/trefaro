import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslationsForTest } from '@trefaro/shared-i18n';
import { NotificationOffer } from './notification-offer';
import { PushSubscriptionService } from './push-subscription.service';

const CATALOGUE = {
  'push.offer.title': 'Notifications',
  'push.offer.body': 'We can tell you when an event you registered for moves.',
  'push.offer.allow': 'Allow notifications',
  'push.offer.later': 'Not now',
};

/** The service's decisions, stated — its own suite is where they are made. */
class FakePush {
  readonly offer = signal(true);
  readonly offering = this.offer.asReadonly();
  subscribed = 0;
  dismissed = 0;

  async subscribe(): Promise<void> {
    this.subscribed += 1;
  }

  dismiss(): void {
    this.dismissed += 1;
    this.offer.set(false);
  }
}

/**
 * The order NFR 4 asks for: the explanation is on screen, and only a click
 * reaches the browser's own dialogue.
 */
describe('NotificationOffer', () => {
  let push: FakePush;

  function render() {
    push = new FakePush();
    TestBed.configureTestingModule({
      providers: [
        provideTranslationsForTest(CATALOGUE),
        { provide: PushSubscriptionService, useValue: push },
      ],
    });
    const fixture = TestBed.createComponent(NotificationOffer);
    fixture.detectChanges();
    return fixture;
  }

  it('says what will be sent before anything asks for a permission', () => {
    const fixture = render();

    expect(fixture.nativeElement.textContent).toContain('Notifications');
    expect(fixture.nativeElement.textContent).toContain(
      'when an event you registered for moves',
    );
    // Nothing has been asked yet: rendering the offer must not prompt.
    expect(push.subscribed).toBe(0);
  });

  it('asks the browser only when the offer is accepted', () => {
    const fixture = render();

    fixture.nativeElement
      .querySelector('.offer__accept')
      .dispatchEvent(new Event('click'));

    expect(push.subscribed).toBe(1);
  });

  it('declines for good, and stops rendering', () => {
    const fixture = render();

    fixture.nativeElement
      .querySelector('.offer__dismiss')
      .dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(push.dismissed).toBe(1);
    expect(fixture.nativeElement.textContent.trim()).toBe('');
    expect(push.subscribed).toBe(0);
  });

  it('shows nothing where the offer cannot be followed', () => {
    const fixture = render();
    push.offer.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });
});
