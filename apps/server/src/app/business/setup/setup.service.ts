import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import type {
  SetupResult,
  SetupState,
  SetupSubmission,
} from '@trefaro/shared-models';
import type { TrefaroEnv } from '../../core/config/env';
import { ENV } from '../../core/config/env.module';
import { ConfigurationService } from '../config';
import { AdminUserService } from '../login';
import { MAIL_TEMPLATE_LOCALES } from '../mail';
import { SetupTokenService } from './setup-token.service';
import { startupWarnings } from './startup-report';

/**
 * First-run setup of a fresh instance (FR 1.1, UC 02, AP 5 of phase 2).
 *
 * Above the modules it composes, like the dashboard and the invitations before
 * it: it asks the login module for the first account, the configuration module
 * for the instance's name, colours and language, and the mail module which
 * languages this image can actually send in. It owns none of them — what it owns
 * is the one-time window in which all of that may be written without a session.
 *
 * That window is a single condition, asked of the database every time: no
 * administrator exists. Not a flag, not a file, not the token's presence — the
 * question "can anybody log in to this instance?" is the question the setup
 * answers, and the only state that can never disagree with it is the answer
 * itself (E28).
 */
@Injectable()
export class SetupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SetupService.name);

  constructor(
    private readonly admins: AdminUserService,
    private readonly configuration: ConfigurationService,
    private readonly tokens: SetupTokenService,
    @Inject(ENV) private readonly env: TrefaroEnv,
  ) {}

  /**
   * Writes the operator's checklist to the log, and the token if one is needed.
   *
   * Runs after `AdminUserService`'s own bootstrap hook, because this module
   * imports the login module and Nest initialises a module's dependencies first:
   * an instance configured with `ADMIN_BOOTSTRAP_*` (E3) therefore already has
   * its administrator by the time this asks, and no token is issued for it.
   */
  async onApplicationBootstrap(): Promise<void> {
    for (const warning of startupWarnings(this.env)) {
      this.logger.warn(warning);
    }

    if (await this.admins.hasAny()) return;

    // Written as one block with blank lines around it: this is the one log line
    // an operator has to find in a container's output, and a token wrapped into
    // a sentence is a token that gets copied with a full stop attached.
    this.logger.warn(
      'This instance has no administrator yet. Open the organizer client and paste ' +
        `the setup token below.\n\n    ${this.tokens.issue()}\n\n` +
        'It is valid until an administrator exists and is replaced on every restart. ' +
        'Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD instead for an ' +
        'unattended installation.',
    );
  }

  /** Whether the setup endpoints exist at all — the only existence condition. */
  async isPending(): Promise<boolean> {
    return !(await this.admins.hasAny());
  }

  /** Whether a candidate token is the one this process issued. */
  acceptsToken(candidate: unknown): boolean {
    return this.tokens.matches(candidate);
  }

  /**
   * What the form fills itself in with, plus what the operator should know.
   *
   * The values are the ones a fresh instance was seeded with, so the wizard
   * shows Trefaro's defaults rather than empty fields — an organization that
   * only wants a name typed should not have to pick two colours.
   */
  async state(): Promise<SetupState> {
    // The public payload rather than `getSettings()`, because it is the only one
    // that carries the locale — and both colours in it are the stored values,
    // not derived ones. The font is not offered here: it has a catalogue and a
    // preview on the design page, and a wizard that asks five questions instead
    // of four is a wizard fewer operators finish.
    const config = await this.configuration.getAppConfig();

    return {
      organizationName: config.organizationName,
      primaryColor: config.theme.primaryColor,
      accentColor: config.theme.accentColor,
      defaultLocale: config.defaultLocale,
      locales: MAIL_TEMPLATE_LOCALES,
      warnings: startupWarnings(this.env),
    };
  }

  /**
   * Claims the instance: its identity first, then the account that closes the
   * window.
   *
   * The order is deliberate. Creating the administrator is what makes these
   * endpoints answer 404, so it goes last: if a value is refused on the way
   * there, the operator gets the wizard back with the configuration they already
   * managed to write, instead of a closed route and a half-configured instance.
   *
   * The pending check is repeated here even though the guard has just made it:
   * two submissions arriving together would otherwise both find an empty table.
   * The second one gets the same 404 it would get a second later.
   */
  async complete(submission: SetupSubmission): Promise<SetupResult> {
    if (!(await this.isPending())) {
      throw new NotFoundException();
    }

    if (!MAIL_TEMPLATE_LOCALES.includes(submission.defaultLocale)) {
      // The set is small and shipped with the image, so this is a closed
      // question. It opens up in AP 7, where an organization maintains its own
      // languages — until then a locale without mail templates would send
      // English confirmations while claiming to be German.
      throw new BadRequestException(
        `defaultLocale must be one of the languages this instance ships: ${MAIL_TEMPLATE_LOCALES.join(', ')}`,
      );
    }

    const settings = await this.configuration.updateSettings({
      organizationName: submission.organizationName,
      primaryColor: submission.primaryColor,
      accentColor: submission.accentColor,
    });
    await this.configuration.setDefaultLocale(submission.defaultLocale);

    const admin = await this.admins.create(submission.admin);
    // Spent, and the route is closed by the account that now exists.
    this.tokens.discard();
    this.logger.log(
      `First-run setup completed for "${settings.organizationName}" by ${admin.email}`,
    );

    return {
      adminEmail: admin.email,
      organizationName: settings.organizationName,
    };
  }
}
