import { ArgumentsHost, Logger, NotFoundException } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { refuse } from '../../business/common/problem';
import { RuntimeMetricsService } from '../operations/runtime-metrics.service';
import { AllExceptionsFilter } from './all-exceptions.filter';

interface Sent {
  readonly body: Record<string, unknown>;
  readonly status: number;
}

interface Written {
  readonly level: 'error' | 'warn' | 'debug';
  readonly message: string;
}

interface Run {
  readonly sent: Sent;
  readonly written: readonly Written[];
  readonly metrics: RuntimeMetricsService;
}

function run(
  exception: unknown,
  url = '/api/events',
  metrics = new RuntimeMetricsService(),
): Run {
  let sent: Sent | null = null;
  const written: Written[] = [];
  const capture =
    (level: Written['level']) =>
    (message: unknown): undefined => {
      written.push({ level, message: String(message) });
      return undefined;
    };
  const spies = [
    jest.spyOn(Logger.prototype, 'error').mockImplementation(capture('error')),
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(capture('warn')),
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(capture('debug')),
  ];

  const adapter = {
    getRequestUrl: () => url,
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

  try {
    new AllExceptionsFilter(
      { httpAdapter: adapter } as unknown as HttpAdapterHost,
      metrics,
    ).catch(exception, host);
  } finally {
    for (const spy of spies) spy.mockRestore();
  }

  if (sent === null) throw new Error('the filter answered nothing');
  return { sent, written, metrics };
}

describe('the exception filter', () => {
  it('sends the code and the values of a refusal', () => {
    // The whole point of E64: what leaves the server is a key and its gaps,
    // never a sentence in a language nobody chose.
    const { sent } = run(
      refuse('problem.field.required', { label: 'Passport scan' }),
    );

    expect(sent.status).toBe(400);
    expect(sent.body.code).toBe('problem.field.required');
    expect(sent.body.params).toEqual({ label: 'Passport scan' });
  });

  it('leaves an error without a code without one', () => {
    const { sent } = run(new NotFoundException('No such event'));

    expect(sent.status).toBe(404);
    expect(sent.body.code).toBeUndefined();
    expect(sent.body.params).toBeUndefined();
  });

  it('says nothing about an error it did not expect', () => {
    const { sent } = run(new Error('the database is on fire'));

    expect(sent.status).toBe(500);
    expect(sent.body.message).toBe('Internal server error');
    expect(sent.body.code).toBeUndefined();
  });

  it('gives a fault a mark, and writes the same mark into the log', () => {
    // The whole mechanism of AP 10: what the person on the screen can read
    // out, and what the operator can search the log for, are one string —
    // which is how a fault gets diagnosed without anybody logging who hit it.
    const { sent, written } = run(new Error('the database is on fire'));

    const mark = sent.body.incident;
    expect(mark).toMatch(/^[0-9a-f]{8}$/);
    expect(written.filter(({ level }) => level === 'error')).toHaveLength(1);
    expect(written[0].message).toContain(String(mark));
  });

  it('gives two faults two marks', () => {
    const first = run(new Error('one')).sent.body.incident;
    const second = run(new Error('two')).sent.body.incident;

    expect(first).not.toBe(second);
  });

  it('marks nothing a caller can fix by themselves', () => {
    expect(
      run(new NotFoundException('No such event')).sent.body.incident,
    ).toBeUndefined();
    expect(
      run(refuse('problem.field.required', {})).sent.body.incident,
    ).toBeUndefined();
  });

  it('logs a path without the values that were in it', () => {
    const { sent, written } = run(
      new Error('the database is on fire'),
      '/api/admin/events/8f1c/registrations?search=Schulze',
    );

    expect(written[0].message).not.toContain('Schulze');
    expect(written[0].message).toContain('search=…');
    // And the answer does not carry it back either: an error body is the thing
    // somebody pastes into a bug report.
    expect(String(sent.body.path)).not.toContain('Schulze');
  });

  it('keeps an expected client error out of an operator’s way', () => {
    const { written } = run(new NotFoundException('No such event'));

    expect(written).toEqual([expect.objectContaining({ level: 'debug' })]);
  });

  it('tells the tally what it answered, with the path already redacted', () => {
    const metrics = new RuntimeMetricsService();

    run(new Error('boom'), '/api/admin/events?search=Schulze', metrics);
    run(new NotFoundException('nope'), '/api/events/unknown', metrics);

    const snapshot = metrics.snapshot();
    expect(snapshot.requests).toMatchObject({
      serverErrors: 1,
      clientErrors: 1,
    });
    expect(snapshot.lastIncident?.path).toBe('/api/admin/events?search=…');
  });

  it('works without a tally at all, because a filter must not need one', () => {
    let sent: Sent | null = null;
    const adapter = {
      getRequestUrl: () => '/api/events',
      reply: (_r: unknown, body: Record<string, unknown>, status: number) => {
        sent = { body, status };
      },
    };
    const host = {
      switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
    } as unknown as ArgumentsHost;
    const quiet = jest
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => undefined);

    new AllExceptionsFilter({
      httpAdapter: adapter,
    } as unknown as HttpAdapterHost).catch(new NotFoundException('nope'), host);
    quiet.mockRestore();

    expect(sent).not.toBeNull();
  });
});
