import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ContactService } from './contact.service';

/**
 * The one call of the contact form (FR 3.4, UC 14, F11).
 *
 * Two things about the request are the contract: it goes to the **public**
 * prefix, because nobody is signed in (E33), and it is a POST with the
 * question in the body — a public form that changed state on a GET would be
 * triggered by every link previewer that saw its address.
 */
describe('ContactService', () => {
  let service: ContactService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ContactService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('posts the question to the event’s public address', () => {
    void service.send('buergerraete', 'kickoff', {
      name: 'Amina Okonkwo',
      email: 'amina@example.org',
      body: 'Is the venue accessible?',
    });

    const request = http.expectOne(
      '/api/user/series/buergerraete/events/kickoff/contact',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Amina Okonkwo',
      email: 'amina@example.org',
      body: 'Is the venue accessible?',
    });
    request.flush({ email: 'amina@example.org' });
  });

  it('escapes what belongs to the path, not to the body', () => {
    void service.send('bürger räte', 'kick/off', {
      name: 'Amina',
      email: 'amina@example.org',
      body: 'Hello',
    });

    // A slug reaches this service from the router, so it is whatever stood in
    // the address bar: encoded here rather than trusted, the way every other
    // public read of this client does it.
    http
      .expectOne(
        `/api/user/series/${encodeURIComponent('bürger räte')}/events/${encodeURIComponent('kick/off')}/contact`,
      )
      .flush({ email: 'amina@example.org' });
  });
});
