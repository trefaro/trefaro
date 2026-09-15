import {
  BadRequestException,
  ConflictException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { conflict, refusalOf, refuse, tooLarge } from './problem';

describe('a refusal', () => {
  it('is a bad request carrying its code and values', () => {
    const error = refuse('problem.field.required', { label: 'Passport scan' });

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getStatus()).toBe(400);
    expect(refusalOf(error)).toEqual({
      code: 'problem.field.required',
      params: { label: 'Passport scan' },
    });
  });

  it('says its code where an error says its message', () => {
    // So a log line, a stack trace and `expect(…).toThrow('problem.…')` all
    // name the reason — there is no sentence left for them to name.
    expect(refuse('problem.field.keyShape').message).toBe(
      'problem.field.keyShape',
    );
  });

  it('carries no values when there are none to carry', () => {
    expect(refusalOf(refuse('problem.field.noChoices'))).toEqual({
      code: 'problem.field.noChoices',
    });
  });

  it('comes as a conflict where the request is refused by the state', () => {
    const error = conflict('problem.event.slugTaken', { slug: 'summer-camp' });

    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getStatus()).toBe(409);
    expect(refusalOf(error)).toEqual({
      code: 'problem.event.slugTaken',
      params: { slug: 'summer-camp' },
    });
  });

  it('comes as a payload too large where a file is the reason', () => {
    const error = tooLarge('problem.upload.tooLarge', {
      max: '5 MB',
      size: '7.2 MB',
    });

    expect(error).toBeInstanceOf(PayloadTooLargeException);
    expect(error.getStatus()).toBe(413);
    expect(refusalOf(error)?.code).toBe('problem.upload.tooLarge');
  });
});

describe('reading a refusal', () => {
  it('finds nothing in an error that gave no code', () => {
    expect(refusalOf(new BadRequestException('just a sentence'))).toBeNull();
    expect(refusalOf(new Error('boom'))).toBeNull();
    expect(refusalOf(undefined)).toBeNull();
  });

  it('finds nothing in a code this build does not know', () => {
    // The body of an exception is typed, but a plug-in could throw anything —
    // and a code the catalogue has no sentence for would reach a screen raw.
    const stranger = new BadRequestException({
      message: 'problem.nowhere.atAll',
      code: 'problem.nowhere.atAll',
    });

    expect(refusalOf(stranger)).toBeNull();
  });
});
