import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  PUSH_MODULE_KEY,
  type TranslationCatalogue,
} from '@trefaro/shared-models';
import * as webPush from 'web-push';
import type { TrefaroEnv } from '../../core/config/env';
import { ENV } from '../../core/config/env.module';
import { ConfigurationService, CoreModuleRegistryService } from '../config';
import { CatalogueService } from '../i18n';
import type {
  EventChangeNotice,
  MessageNotice,
  PushDeliveryReport,
  PushNotification,
} from './push-notification';
import { eventChangeNotification, messageNotification } from './push-texts';
import {
  PUSH_SUBSCRIPTION_REPOSITORY,
  type PushSubscriptionInput,
  type PushSubscriptionRepository,
  type PushTarget,
} from './ports/push-subscription.repository';

/** Status codes with which a push service declares a subscription dead. */
const GONE_STATUS_CODES = new Set([404, 410]);

/** Nothing went out, and nothing was wrong with that. */
const NOTHING: PushDeliveryReport = { delivered: 0, failed: 0, expired: 0 };

/**
 * Self-hosted Web Push (F7, FR 3.15).
 *
 * The instance signs its own messages with a VAPID key pair, so notifications
 * work without Firebase or any other third-party push service (NFR 9). On iOS
 * this only works for an installed PWA — accepted when the decision was made.
 *
 * Push stays optional in two independent ways, and both are asked before
 * anything is sent:
 *
 * 1. **No key pair** — the instance was never set up for push. It starts
 *    normally and reports push as unavailable.
 * 2. **The `push` module switched off** (E21). The endpoints answer 404
 *    through their guard; this service has to ask for itself, because a
 *    notification is not triggered by a request. Switching a module off never
 *    deletes rows (F63), so the subscriptions are still there — an organizer
 *    who switched notifications off would otherwise keep sending them.
 *
 * **A notification never fails the thing it is about.** Both `notify…` methods
 * answer with a report instead of throwing: an organizer moving a session must
 * not get an error because a browser vendor's push service is down, and a
 * message must not fail to save because a device is gone. Only the two methods
 * a *request* calls — subscribing — refuse loudly, because there the caller
 * asked for exactly this and can be told.
 *
 * **The words come from the catalogue, the facts from the caller.** Which
 * words, and in whose language, is this module's business (see
 * `push-texts.ts`); that something changed is the caller's. That is why the
 * events module hands over a notice rather than a title and a body.
 */
@Injectable()
export class PushService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @Inject(ENV) private readonly env: TrefaroEnv,
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: PushSubscriptionRepository,
    // The same registry the endpoints' guard reads (F53), for the same reason
    // the chat gateway consults it at its door: a switch that only hid the
    // client's button would not be a switch.
    private readonly modules: CoreModuleRegistryService,
    // The language of a device that has no account — the instance's own.
    private readonly configuration: ConfigurationService,
    private readonly catalogues: CatalogueService,
  ) {}

  onApplicationBootstrap(): void {
    const config = this.env.webPush;
    if (!config) {
      this.logger.log(
        'Web Push disabled — set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to enable it',
      );
      return;
    }
    webPush.setVapidDetails(
      config.subject,
      config.publicKey,
      config.privateKey,
    );
    this.logger.log('Web Push enabled');
  }

  isConfigured(): boolean {
    return this.env.webPush !== null;
  }

  async subscribe(input: PushSubscriptionInput): Promise<void> {
    this.assertConfigured();
    await this.subscriptions.save(input);
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await this.subscriptions.deleteByEndpoint(endpoint);
  }

  /**
   * Tells an event's audience that it moved, changed place or is off (F176).
   *
   * Who that audience is, is the port's answer and not this method's: the
   * confirmed registrants' devices and every device without an account (E43).
   */
  async notifyEventChange(
    notice: EventChangeNotice,
  ): Promise<PushDeliveryReport> {
    if (!this.available() || notice.changes.length === 0) return NOTHING;

    const targets = await this.subscriptions.findForEventChange(notice.eventId);
    return this.deliver(targets, (catalogue, locale) =>
      eventChangeNotification(catalogue, locale, notice),
    );
  }

  /**
   * Tells one participant's devices that there is something for them (E44).
   *
   * Whether they should be told at all — whether somebody is watching the
   * conversation this second — is decided by the caller, which is the only
   * place that knows who has a socket open in which room.
   */
  async notifyParticipant(
    userId: string,
    notice: MessageNotice,
  ): Promise<PushDeliveryReport> {
    if (!this.available()) return NOTHING;

    const targets = await this.subscriptions.findForParticipant(userId);
    return this.deliver(targets, (catalogue) =>
      messageNotification(catalogue, notice),
    );
  }

  /**
   * Sends one notification to an audience, in each device's own language.
   *
   * Grouped by language rather than rendered per device: a catalogue is a
   * resolution of three sources (E23) and an organization with fifty
   * subscribers has two languages, not fifty. A device without an account
   * counts as the instance's default language (F125) — the only answer there
   * is, since nobody has said otherwise.
   *
   * One failing endpoint must not abort the rest, so deliveries run
   * independently and the result is reported as counts. Subscriptions the push
   * service declares gone are removed — otherwise the table grows with every
   * uninstalled browser.
   */
  private async deliver(
    targets: readonly PushTarget[],
    render: (
      catalogue: TranslationCatalogue,
      locale: string,
    ) => PushNotification,
  ): Promise<PushDeliveryReport> {
    if (targets.length === 0) return NOTHING;

    const fallback = await this.defaultLocale();
    const groups = new Map<string, PushTarget[]>();
    for (const target of targets) {
      const locale = target.locale ?? fallback;
      const group = groups.get(locale);
      if (group) group.push(target);
      else groups.set(locale, [target]);
    }

    const reports = await Promise.all(
      [...groups].map(async ([locale, group]) => {
        const { catalogue } = await this.catalogues.resolve(locale);
        return this.send(group, render(catalogue, locale));
      }),
    );

    return reports.reduce(add, NOTHING);
  }

  private async send(
    targets: readonly PushTarget[],
    notification: PushNotification,
  ): Promise<PushDeliveryReport> {
    const payload = JSON.stringify({
      notification: {
        title: notification.title,
        body: notification.body,
        data: notification.url ? { url: notification.url } : undefined,
      },
    });

    let delivered = 0;
    let failed = 0;
    let expired = 0;

    await Promise.all(
      targets.map(async (target) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: target.endpoint,
              keys: { p256dh: target.p256dhKey, auth: target.authKey },
            },
            payload,
          );
          delivered += 1;
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode !== undefined && GONE_STATUS_CODES.has(statusCode)) {
            await this.subscriptions.deleteByEndpoint(target.endpoint);
            expired += 1;
            return;
          }
          failed += 1;
          // The reason, not only the status: a push service that answers 500
          // and a payload the library refuses to encrypt are the same line
          // without it, and the second one is a defect rather than weather.
          this.logger.warn(
            `Push delivery failed (status ${statusCode ?? 'none'}): ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }),
    );

    return { delivered, failed, expired };
  }

  /** Whether this instance can and may notify at all. */
  private available(): boolean {
    if (!this.isConfigured()) return false;
    if (!this.modules.isEnabled(PUSH_MODULE_KEY)) return false;
    return true;
  }

  private async defaultLocale(): Promise<string> {
    const { defaultLocale } = await this.configuration.getLocaleSettings();
    return defaultLocale.trim().toLowerCase();
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Web Push is not configured on this instance',
      );
    }
  }
}

function add(
  total: PushDeliveryReport,
  one: PushDeliveryReport,
): PushDeliveryReport {
  return {
    delivered: total.delivered + one.delivered,
    failed: total.failed + one.failed,
    expired: total.expired + one.expired,
  };
}
