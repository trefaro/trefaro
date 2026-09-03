import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ConversationsAdminService } from './conversations-admin.service';

/**
 * The organization's calls (FR 3.4 — AP 10).
 *
 * The shape of the requests is the contract, and three of them carry a
 * decision: an answer is a **POST** to the conversation's own messages (F174),
 * a group is a POST to the collection because a group is the only kind an
 * organizer creates, and a picture is **fetched** rather than linked — the URL
 * in the message is served to members of a conversation, which the
 * organization is not (F133, F156).
 */
describe('ConversationsAdminService', () => {
  let service: ConversationsAdminService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ConversationsAdminService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('asks for the overview without spelling out the defaults', () => {
    void service.list({});

    const request = http.expectOne('/api/admin/conversations');
    expect(request.request.method).toBe('GET');
    request.flush({ rows: [], total: 0, page: 1, pageSize: 20 });
  });

  it('sends the window it wants when it wants one', () => {
    void service.list({ page: 2, pageSize: 5 });

    const request = http.expectOne(
      '/api/admin/conversations?page=2&pageSize=5',
    );
    request.flush({ rows: [], total: 0, page: 2, pageSize: 5 });
  });

  it('pages the history by a cursor, never by a page number (F154)', () => {
    void service.history('conversation-1', { before: 'message-9' });

    const request = http.expectOne(
      '/api/admin/conversations/conversation-1/messages?before=message-9',
    );
    expect(request.request.method).toBe('GET');
    request.flush({ rows: [], hasMore: false });
  });

  it('answers with a POST that carries only the text', () => {
    void service.reply('conversation-1', 'Yes, it is.');

    const request = http.expectOne(
      '/api/admin/conversations/conversation-1/messages',
    );
    expect(request.request.method).toBe('POST');
    // No picture: an answer has to work as a mail too (E40 belongs to the
    // participants' side of this module).
    expect(request.request.body).toEqual({ body: 'Yes, it is.' });
    request.flush({ message: null, delivery: 'sent' });
  });

  it('asks for the candidates of one event', () => {
    void service.candidates('event-1');

    const request = http.expectOne(
      '/api/admin/conversations/candidates?eventId=event-1',
    );
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('creates a group on the collection itself', () => {
    void service.createGroup({
      eventId: 'event-1',
      topic: 'Travel',
      profileIds: ['profile-1'],
    });

    const request = http.expectOne('/api/admin/conversations');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      eventId: 'event-1',
      topic: 'Travel',
      profileIds: ['profile-1'],
    });
    request.flush({});
  });

  it('fetches a picture as bytes from the organizer’s own route (F133)', () => {
    // Deliberately not the `imageUrl` of the message: that one is under
    // `/api/media` and decides access by membership.
    void service.image('conversation-1', 'message-1').catch(() => undefined);

    const request = http.expectOne(
      '/api/admin/conversations/conversation-1/messages/message-1/image',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['png']));
  });
});
