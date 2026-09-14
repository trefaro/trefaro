import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { ThrottlerException, ThrottlerStorageService } from '@nestjs/throttler';
import { REGISTRATION_PAYLOAD_PART } from '@trefaro/shared-models';
import { of } from 'rxjs';
import { RATE_LIMIT_DEFAULTS, type RateLimitEnv } from '../config/rate-limits';
import { RecipientThrottleInterceptor } from './recipient-throttle.interceptor';

const limits: RateLimitEnv = {
  ...RATE_LIMIT_DEFAULTS,
  mailsPerRecipientPerWindow: 2,
  profile: null,
};

function contextOf(body: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ body }) }),
  } as unknown as ExecutionContext;
}

const handler: CallHandler = { handle: () => of('sent') };

describe('RecipientThrottleInterceptor', () => {
  let storage: ThrottlerStorageService;
  let interceptor: RecipientThrottleInterceptor;

  /** Runs the interceptor once and reports whether it let the request through. */
  const send = async (body: unknown): Promise<'through' | 'refused'> => {
    try {
      await interceptor.intercept(contextOf(body), handler);
      return 'through';
    } catch (error) {
      if (error instanceof ThrottlerException) return 'refused';
      throw error;
    }
  };

  beforeEach(() => {
    storage = new ThrottlerStorageService();
    interceptor = new RecipientThrottleInterceptor(storage, limits);
  });

  afterEach(() => storage.onApplicationShutdown());

  it('lets a recipient through up to the configured number of mails', async () => {
    const body = { email: 'someone@example.org' };

    expect(await send(body)).toBe('through');
    expect(await send(body)).toBe('through');
    expect(await send(body)).toBe('refused');
  });

  // The whole reason this counter exists: the four limits next to it count the
  // *caller*, and a caller is free to change address. The recipient is not.
  it('counts one address across every route that mails to it', async () => {
    expect(await send({ email: 'victim@example.org' })).toBe('through');
    expect(await send({ email: 'victim@example.org' })).toBe('through');
    expect(await send({ email: 'victim@example.org' })).toBe('refused');

    // A different inbox has its own budget — one person's flood must never
    // lock out the next person to fill in the form.
    expect(await send({ email: 'someone-else@example.org' })).toBe('through');
  });

  it('treats an address as one address whatever its case and spacing', async () => {
    expect(await send({ email: 'Someone@Example.org' })).toBe('through');
    expect(await send({ email: '  someone@example.org  ' })).toBe('through');
    expect(await send({ email: 'SOMEONE@EXAMPLE.ORG' })).toBe('refused');
  });

  /*
   * A registration form with a file field submits `multipart/form-data`, where
   * the body is a flat map of strings and the fields sit in one JSON part. The
   * parser has run by the time this interceptor does — that is why it is an
   * interceptor declared after the multipart one and not a guard, which would
   * run before any of it and see an empty body. Without this the counter would
   * have a bypass: send multipart, count nothing.
   */
  it('finds the address in a multipart submission too', async () => {
    const multipart = {
      [REGISTRATION_PAYLOAD_PART]: JSON.stringify({
        email: 'victim@example.org',
        answers: {},
      }),
    };

    expect(await send(multipart)).toBe('through');
    expect(await send({ email: 'victim@example.org' })).toBe('through');
    expect(await send(multipart)).toBe('refused');
  });

  it("lets a body it cannot read through — refusing it is the validator's job", async () => {
    expect(await send({})).toBe('through');
    expect(await send({ email: 42 })).toBe('through');
    expect(await send(undefined)).toBe('through');
    expect(await send({ [REGISTRATION_PAYLOAD_PART]: 'not json' })).toBe(
      'through',
    );
  });
});
