import { ApiProperty } from '@nestjs/swagger';
import {
  IsDefined,
  IsNotEmpty,
  IsObject,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Push endpoints are absolute URLs issued by a browser vendor.
 *
 * `require_protocol` is what makes this strict: without it, `isUrl` accepts a
 * bare word like `not-a-url` as a hostname. `require_tld` stays off so a local
 * mock push service on `http://localhost` can be used in development.
 */
// Not `as const`: `IsUrl` expects a mutable `protocols` array.
const PUSH_ENDPOINT_URL_OPTIONS = {
  require_tld: false,
  require_protocol: true,
  protocols: ['https', 'http'],
};

/** The `keys` object exactly as the browser's PushSubscription provides it. */
export class PushSubscriptionKeysDto {
  @ApiProperty({ description: 'Client public key (P-256 ECDH), base64url.' })
  @IsString()
  @IsNotEmpty()
  p256dh!: string;

  @ApiProperty({ description: 'Client auth secret, base64url.' })
  @IsString()
  @IsNotEmpty()
  auth!: string;
}

/**
 * Body of a subscribe request.
 *
 * Shaped after the browser's `PushSubscription.toJSON()` so the client can post
 * it unchanged.
 */
export class CreatePushSubscriptionDto {
  @ApiProperty({
    description: 'Push service endpoint issued by the browser vendor.',
    example: 'https://push.example.org/abc123',
  })
  @IsUrl(PUSH_ENDPOINT_URL_OPTIONS)
  endpoint!: string;

  @ApiProperty({ type: PushSubscriptionKeysDto })
  // `ValidateNested` alone ignores a missing value, which would let the request
  // through and fail later while reading `keys.p256dh`.
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys!: PushSubscriptionKeysDto;
}

/** Body of an unsubscribe request. */
export class DeletePushSubscriptionDto {
  @ApiProperty({ description: 'Endpoint of the subscription to remove.' })
  @IsUrl(PUSH_ENDPOINT_URL_OPTIONS)
  endpoint!: string;
}
