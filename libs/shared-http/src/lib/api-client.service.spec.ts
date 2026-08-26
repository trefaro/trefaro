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

  it('translates a failure into an ApiError instead of an HttpErrorResponse', async () => {
    configure();
    const failure = new Promise<ApiError>((resolve) => {
      client.get('config').subscribe({ error: resolve });
    });

    http
      .expectOne('/api/config')
      .flush(
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
