import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from './api-base-url';
import { ApiClient } from './api-client.service';
import type { ApiError } from './api-error';

describe('ApiClient', () => {
  let client: ApiClient;
  let http: HttpTestingController;

  function configure(baseUrl?: string): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ...(baseUrl ? [{ provide: API_BASE_URL, useValue: baseUrl }] : []),
      ],
    });
    client = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  }

  afterEach(() => http.verify());

  it('defaults to the same-origin /api path', () => {
    configure();
    client.get('config').subscribe();

    http.expectOne('/api/config').flush({});
  });

  it('joins base and path with exactly one slash', () => {
    configure('/api/');
    client.get('/config').subscribe();

    http.expectOne('/api/config').flush({});
  });

  it('encodes query parameters instead of leaving that to the caller', () => {
    configure();
    client
      .get('admin/events/1/registrations', {
        search: 'Okonkwo & Co',
        page: 2,
        pageSize: 25,
      })
      .subscribe();

    const request = http.expectOne(
      (candidate) =>
        candidate.url === '/api/admin/events/1/registrations' &&
        candidate.params.get('search') === 'Okonkwo & Co' &&
        candidate.params.get('page') === '2',
    );
    // A name with an ampersand in it must not turn into a second parameter.
    expect(request.request.urlWithParams).toContain(
      'search=Okonkwo%20%26%20Co',
    );
    request.flush({});
  });

  it('leaves unset parameters out of the URL', () => {
    configure();
    client
      .get('admin/events/1/registrations', {
        search: '',
        status: undefined,
        sort: null,
        page: 1,
      })
      .subscribe();

    const request = http.expectOne(
      (candidate) => candidate.url === '/api/admin/events/1/registrations',
    );
    // So a table showing its defaults produces a short, shareable URL.
    expect(request.request.urlWithParams).toBe(
      '/api/admin/events/1/registrations?page=1',
    );
    request.flush({});
  });

  it('sends a body on delete, which unsubscribing from push needs', () => {
    configure();
    client
      .delete('user/push/subscriptions', { endpoint: 'https://push/x' })
      .subscribe();

    const request = http.expectOne('/api/user/push/subscriptions');
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toEqual({ endpoint: 'https://push/x' });
    request.flush(null);
  });

  it('asks for a blob where the answer is a file, not JSON', () => {
    configure();
    client.file('admin/attachments/attachment-1').subscribe();

    // An attachment download (E9): the bytes come through the same session as
    // every other request, which a link opened in a new tab cannot promise.
    const request = http.expectOne('/api/admin/attachments/attachment-1');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['%PDF-1.7']));
  });

  it('leaves a FormData body alone, so the browser sets the boundary', () => {
    configure();
    const form = new FormData();
    form.append('payload', '{"email":"amina@example.org"}');
    client.post('user/series/a/events/b/registrations', form).subscribe();

    const request = http.expectOne('/api/user/series/a/events/b/registrations');
    expect(request.request.body).toBe(form);
    // No content type of ours: Angular would send it without a boundary, and a
    // multipart body without one cannot be parsed.
    expect(request.request.headers.has('Content-Type')).toBe(false);
    request.flush({ email: 'amina@example.org' });
  });

  it('translates a failure into an ApiError instead of an HttpErrorResponse', async () => {
    configure();
    const failure = new Promise<ApiError>((resolve) => {
      client.get('config').subscribe({ error: resolve });
    });

    http.expectOne('/api/config').flush(
      {
        statusCode: 503,
        message: 'Web Push is not configured on this instance',
      },
      { status: 503, statusText: 'Service Unavailable' },
    );

    await expect(failure).resolves.toEqual({
      status: 503,
      message: 'Web Push is not configured on this instance',
      retryable: true,
    });
  });
});
