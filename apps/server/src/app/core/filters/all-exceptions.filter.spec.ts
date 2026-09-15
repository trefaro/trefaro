import { ArgumentsHost, NotFoundException } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { refuse } from '../../business/common/problem';
import { AllExceptionsFilter } from './all-exceptions.filter';

interface Sent {
  readonly body: Record<string, unknown>;
  readonly status: number;
}

function run(exception: unknown): Sent {
  let sent: Sent | null = null;
  const adapter = {
    getRequestUrl: () => '/api/events',
    reply: (
      _response: unknown,
      body: Record<string, unknown>,
      status: number,
    ) => {
      sent = { body, status };
    },
  };
  const host = {
    switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter({
    httpAdapter: adapter,
  } as unknown as HttpAdapterHost).catch(exception, host);

  if (sent === null) throw new Error('the filter answered nothing');
  return sent;
}

describe('the exception filter', () => {
  it('sends the code and the values of a refusal', () => {
    // The whole point of E64: what leaves the server is a key and its gaps,
    // never a sentence in a language nobody chose.
    const { body, status } = run(
      refuse('problem.field.required', { label: 'Passport scan' }),
    );

    expect(status).toBe(400);
    expect(body.code).toBe('problem.field.required');
    expect(body.params).toEqual({ label: 'Passport scan' });
  });

  it('leaves an error without a code without one', () => {
    const { body, status } = run(new NotFoundException('No such event'));

    expect(status).toBe(404);
    expect(body.code).toBeUndefined();
    expect(body.params).toBeUndefined();
  });

  it('says nothing about an error it did not expect', () => {
    const { body, status } = run(new Error('the database is on fire'));

    expect(status).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(body.code).toBeUndefined();
  });
});
