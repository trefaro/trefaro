import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AppConfigService } from '@trefaro/shared-config';
import { MESSAGE_IMAGE_PART } from '@trefaro/shared-models';
import { ChatService, chatGuard } from './chat.service';

/**
 * The five calls of the chat, plus the switch in front of them (FR 4.5).
 *
 * What is worth asserting here is the shape of the requests, because that is
 * the contract: a cursor rather than a page number for the history (F154), a
 * multipart body only when there is a picture (E40), and a `PUT` for marking
 * as read — nothing that changes state is a GET.
 */
describe('ChatService', () => {
  let service: ChatService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ChatService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('asks for the conversations without spelling out the defaults', () => {
    void service.list();

    const request = http.expectOne('/api/participant/conversations');
    expect(request.request.method).toBe('GET');
    request.flush({ rows: [], total: 0, page: 1, pageSize: 20 });
  });

  it('sends the window it wants when it wants one', () => {
    void service.list({ page: 2, pageSize: 40 });

    http
      .expectOne('/api/participant/conversations?page=2&pageSize=40')
      .flush({ rows: [], total: 0, page: 2, pageSize: 40 });
  });

  it('reads one conversation by its id', () => {
    void service.get('c1');

    const request = http.expectOne('/api/participant/conversations/c1');
    expect(request.request.method).toBe('GET');
    request.flush({});
  });

  it('opens a conversation by profile id, and by nothing else', () => {
    void service.start('p2');

    const request = http.expectOne('/api/participant/conversations');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ profileId: 'p2' });
    request.flush({});
  });

  it('pages the history with a cursor rather than a page number', () => {
    void service.history('c1', { before: 'm9' });

    const request = http.expectOne(
      '/api/participant/conversations/c1/messages?before=m9',
    );
    expect(request.request.method).toBe('GET');
    request.flush({ rows: [], hasMore: false });
  });

  it('sends a message without a picture as plain JSON', () => {
    void service.send('c1', { body: '  Hello there  ' });

    const request = http.expectOne(
      '/api/participant/conversations/c1/messages',
    );
    // Trimmed here rather than on the server: what somebody typed is what is
    // sent, and trailing spaces are not part of what they said.
    expect(request.request.body).toEqual({ body: 'Hello there' });
    request.flush({});
  });

  it('sends a message with a picture as multipart, text included', () => {
    const file = new File(['bytes'], 'photo.png', { type: 'image/png' });

    void service.send('c1', { body: 'Look', image: file });

    const request = http.expectOne(
      '/api/participant/conversations/c1/messages',
    );
    const body = request.request.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('body')).toBe('Look');
    expect(body.get(MESSAGE_IMAGE_PART)).toBe(file);
    // No `payload` part: a message has no nested fields to wrap (F39).
    expect(body.get('payload')).toBeNull();
    request.flush({});
  });

  it('sends a picture alone without an empty text field', () => {
    const file = new File(['bytes'], 'photo.png', { type: 'image/png' });

    void service.send('c1', { image: file });

    const request = http.expectOne(
      '/api/participant/conversations/c1/messages',
    );
    const body = request.request.body as FormData;
    // An empty `body` field is not the same as no text — the endpoint refuses
    // a message that is neither text nor picture, and this one is a picture.
    expect(body.get('body')).toBeNull();
    request.flush({});
  });

  it('marks as read with a PUT, because it changes something', () => {
    void service.markRead('c1');

    const request = http.expectOne('/api/participant/conversations/c1/read');
    expect(request.request.method).toBe('PUT');
    request.flush(null);
  });

  it('escapes an id rather than pasting it into the path', () => {
    void service.history('../me', {});

    http.expectOne('/api/participant/conversations/..%2Fme/messages').flush({
      rows: [],
      hasMore: false,
    });
  });
});

/**
 * The guard in front of both screens (F53, E42).
 *
 * The same two cases as `profileSearchGuard`: the page exists where the module
 * is on, and a bookmark that outlived the switch leads to the start page
 * rather than to a screen that waits for a 404.
 */
describe('chatGuard', () => {
  function run(enabled: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AppConfigService,
          useValue: { isModuleEnabled: () => enabled },
        },
      ],
    });

    return TestBed.runInInjectionContext(() =>
      chatGuard(
        // The guard reads neither argument.
        {} as never,
        {} as never,
      ),
    );
  }

  afterEach(() => TestBed.resetTestingModule());

  it('lets the chat through where the module is switched on', () => {
    expect(run(true)).toBe(true);
  });

  it('sends a bookmark to the start page where it is off', () => {
    const result = run(false);

    expect(result).not.toBe(true);
    expect(String(result)).toBe(
      String(TestBed.inject(Router).createUrlTree(['/'])),
    );
  });
});
