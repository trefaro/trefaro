import {
  Body,
  Controller,
  Delete,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreatePushSubscriptionDto,
  DeletePushSubscriptionDto,
} from './dto/push-subscription.dto';
import { PushService } from './push.service';

/**
 * Web Push subscription management (FR 3.15).
 *
 * Under `/api/user` because only the participant client subscribes — the
 * organizer client sends changes, it does not receive them.
 *
 * Open to anonymous callers for now: participant accounts arrive in phase 3, and
 * only then can a subscription be tied to a person. Until then this endpoint
 * needs rate limiting before an instance goes public, which is noted with the
 * phase 3 work.
 */
@ApiTags('push')
@Controller('user/push/subscriptions')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Register this browser for push notifications' })
  @ApiNoContentResponse({ description: 'Subscription stored.' })
  @ApiServiceUnavailableResponse({
    description: 'This instance has no VAPID key pair configured.',
  })
  async subscribe(
    @Body() body: CreatePushSubscriptionDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    await this.push.subscribe({
      endpoint: body.endpoint,
      p256dhKey: body.keys.p256dh,
      authKey: body.keys.auth,
      userAgent: userAgent ?? null,
    });
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove this browser from push notifications' })
  @ApiNoContentResponse({
    description: 'Subscription removed, or was already gone.',
  })
  async unsubscribe(@Body() body: DeletePushSubscriptionDto): Promise<void> {
    await this.push.unsubscribe(body.endpoint);
  }
}
