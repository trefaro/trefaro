import {
  BadRequestException,
  Injectable,
  ValidationPipe,
  type ArgumentMetadata,
  type PipeTransform,
} from '@nestjs/common';
import { REGISTRATION_PAYLOAD_PART } from '@trefaro/shared-models';
import type { UploadedFile } from '../attachments';
import { VALIDATION_PIPE_OPTIONS } from '../../core/validation';
import { CreateRegistrationDto } from './dto/create-registration.dto';

/**
 * Turns either kind of registration submission into the same validated body.
 *
 * The endpoint accepts `application/json` — which is what a form without a file
 * field sends — and `multipart/form-data`, where the JSON sits in the
 * {@link REGISTRATION_PAYLOAD_PART} part and every file in a part named after
 * its field key.
 *
 * The validation itself is the global pipe's, with the global pipe's options: a
 * body that arrives through multipart is held to exactly the same rules as one
 * that arrives as JSON, including that an unknown property is an error. The
 * parameter it decorates is therefore typed as an interface, so the global pipe
 * — which would see the raw multipart body — leaves it alone.
 */
@Injectable()
export class RegistrationSubmissionPipe implements PipeTransform {
  private readonly validation = new ValidationPipe({
    ...VALIDATION_PIPE_OPTIONS,
    expectedType: CreateRegistrationDto,
  });

  async transform(
    value: unknown,
    metadata: ArgumentMetadata,
  ): Promise<CreateRegistrationDto> {
    return (await this.validation.transform(unwrap(value), {
      ...metadata,
      metatype: CreateRegistrationDto,
    })) as CreateRegistrationDto;
  }
}

/**
 * The JSON body, wherever it came from.
 *
 * A multipart body is a flat map of strings. Exactly one key is expected in it —
 * anything else would be a second way to say the same thing, and the field kit
 * has taught us what silently accepted extra keys cost.
 */
function unwrap(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const payload = value[REGISTRATION_PAYLOAD_PART];
  if (typeof payload !== 'string') return value;

  const extra = Object.keys(value).filter(
    (key) => key !== REGISTRATION_PAYLOAD_PART,
  );
  if (extra.length > 0) {
    throw new BadRequestException(
      `A multipart registration carries its fields in the "${REGISTRATION_PAYLOAD_PART}" ` +
        `part and its files in one part per field — not in ${extra.join(', ')}.`,
    );
  }

  try {
    return JSON.parse(payload);
  } catch {
    throw new BadRequestException(
      `The "${REGISTRATION_PAYLOAD_PART}" part is not valid JSON.`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * One multipart file part, as the parser hands it over.
 *
 * Declared here rather than imported: the shape is four properties wide, and the
 * alternative is a dependency on the type package of a parser that the business
 * layer has no other reason to know.
 */
export interface MultipartFile {
  readonly fieldname: string;
  readonly originalname: string;
  readonly mimetype: string;
  readonly buffer: Buffer;
}

/**
 * The parts of a submission, as the business layer wants them.
 *
 * The part name *is* the field key (F35): a file answers a question, and the
 * question it answers has to be part of the request rather than of an order the
 * client and the server would both have to agree on.
 */
export function toUploadedFiles(
  parts: readonly MultipartFile[] | undefined,
): readonly UploadedFile[] {
  return (parts ?? []).map((part) => ({
    fieldKey: part.fieldname,
    fileName: part.originalname,
    mimeType: part.mimetype,
    bytes: part.buffer,
  }));
}
