import {
  Body,
  Controller,
  Delete,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PUSH_MODULE_KEY } from '@trefaro/shared-models';
import type { Request } from 'express';
import { CoreModuleController, CoreModuleEnabledGuard } from '../config';
import { UserSessionService, participantSessionFromRequest } from '../profiles';
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
 * **Open to anonymous callers, and a session changes what it means** (E43).
 * Whoever posts a subscription gets a row either way — that an event was moved
 * is public information, and a browser that never registered for anything may
 * subscribe from a landing page. A session on the same request binds the row to
 * that account, which is what makes *personal* notifications possible: a new
 * message goes to devices that have an owner. Signing out and re-posting
 * unbinds it again, which is the only way a shared tablet stops carrying
 * somebody's conversations.
 *
 * The session is read here rather than demanded by a guard because neither
 * answer is an error. The global participant guard is deny-or-allow and this is
 * neither, so the cookie is resolved through the same service the guard uses —
 * one implementation of "who is this", as E34 requires.
 *
 * Behind {@link CoreModuleEnabledGuard} since AP 4 of phase 2, because `push` is
 * a core module an organization may switch off (FR 1.5, E21): switched off, this
 * answers 404 and `/api/config` carries no VAPID key, so nothing offers a
 * subscription that would not be stored. That is what makes the switch gate
 * something real — before it, it gated nothing at all.
 */
@ApiTags('push')
@UseGuards(CoreModuleEnabledGuard)
@CoreModuleController(PUSH_MODULE_KEY)
@Controller('user/push/subscriptions')
export class PushController {
  constructor(
    private readonly push: PushService,
    private readonly sessions: UserSessionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Register this browser for push notifications' })
  @ApiNoContentResponse({ description: 'Subscription stored.' })
  @ApiNotFoundResponse({
    description: 'This organization has the push module switched off.',
  })
  @ApiServiceUnavailableResponse({
    description: 'This instance has no VAPID key pair configured.',
  })
  async subscribe(
    @Body() body: CreatePushSubscriptionDto,
    @Req() request: Request,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    await this.push.subscribe({
      endpoint: body.endpoint,
      p256dhKey: body.keys.p256dh,
      authKey: body.keys.auth,
      userAgent: userAgent ?? null,
      userId: await this.ownerOf(request),
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

  /**
   * Whose device this is, if anybody's (E43).
   *
   * An expired or revoked session is the same answer as no session at all: the
   * subscription is stored and belongs to nobody. Refusing it would take
   * notifications away from a browser for the duration of a stale cookie.
   */
  private async ownerOf(request: Request): Promise<string | null> {
    const token = participantSessionFromRequest(request);
    if (!token) return null;

    const participant = await this.sessions.resolve(token);
    return participant?.profile.id ?? null;
  }
}
