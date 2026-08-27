import type { ValidationPipeOptions } from '@nestjs/common';

/**
 * How every request body is validated — declared once, used twice.
 *
 * `main.ts` installs it globally, and the registration form's own pipe reuses it
 * for the body it has to unwrap from a multipart submission first. Two copies of
 * these three options would be two answers to "is an unknown property an
 * error?", and the whole point of `forbidNonWhitelisted` is that there is one.
 */
export const VALIDATION_PIPE_OPTIONS: ValidationPipeOptions = {
  whitelist: true,
  // An unexpected field is a mistake worth reporting, not something to drop
  // silently — a registration form's field kit is configurable, so a typo in a
  // field key must not disappear.
  forbidNonWhitelisted: true,
  transform: true,
};
