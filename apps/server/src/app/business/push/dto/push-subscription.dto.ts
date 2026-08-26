import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUrl, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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
  @IsUrl({ require_tld: false, protocols: ['https', 'http'] })
  endpoint!: string;

  @ApiProperty({ type: PushSubscriptionKeysDto })
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys!: PushSubscriptionKeysDto;
}

/** Body of an unsubscribe request. */
export class DeletePushSubscriptionDto {
  @ApiProperty({ description: 'Endpoint of the subscription to remove.' })
  @IsUrl({ require_tld: false, protocols: ['https', 'http'] })
  endpoint!: string;
}
