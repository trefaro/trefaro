import { Inject, Injectable } from '@nestjs/common';
import {
  PROFILE_DIRECTORY,
  type ProfileDirectory,
} from '../common/ports/profile-directory.port';
import type {
  PluginRegistration,
  PluginRegistrationClaim,
  PluginRegistrationReads,
  PluginRegistrationSlice,
  PluginRegistrationWindow,
} from '../plugin-api/registration-reads';
import { TokenSigner } from '../security';
import {
  REGISTRATION_REPOSITORY,
  type RegistrationRecord,
  type RegistrationRepository,
} from './ports/registration.repository';

/**
 * The core's side of the plug-in registration port (E53, E54, F148).
 *
 * An adapter and nothing more, the cut `ProgramPluginReads` and
 * `ProfilePluginReads` make before it: it turns registration rows into the
 * five fields the contract promises and is the only place that knows both
 * shapes. A plug-in never reaches `registration`; it asks here, through a
 * token, and the rows stay the registration module's business (F21).
 *
 * Three properties are the whole of it, and each is in a statement rather than
 * in a caller (F152):
 *
 * 1. **Confirmed only.** Both reads narrow to `confirmed`, so there is no way
 *    to obtain a ticket for a registration nobody confirmed — an admission
 *    granted by an unverified address — or for one somebody cancelled.
 * 2. **The two claims share one stretch of track.** A link resolves through
 *    the signature, a session through address equality, and from the status
 *    rule down they are the same code — which is what F148 asks of anything
 *    resolving a self-service claim. A plug-in cannot ask for one of the two
 *    readings; it hands over a claim.
 * 3. **No address leaves.** The account claim resolves an address inside this
 *    file, uses it to find rows, and hands out names. A plug-in that could see
 *    an address would be a way around F55.
 *
 * The purpose inside the signature does the rest: the token this port accepts
 * is the self-service one (E11), so a confirmation link cannot be replayed as
 * a ticket lookup. What it deliberately does **not** do is mint a token — a
 * plug-in issues its own opaque code and never this one (E53).
 *
 * Provided by the plug-in host module rather than by `RegistrationModule`: the
 * host module is the seam where core capabilities are published, and this
 * adapter has no other consumer. It reads ports and the signer, never a
 * feature service — the host module imports no feature module, which is the
 * lesson AP 6 learned at the cost of a boot cycle.
 */
@Injectable()
export class RegistrationPluginReads implements PluginRegistrationReads {
  constructor(
    @Inject(REGISTRATION_REPOSITORY)
    private readonly registrations: RegistrationRepository,
    // Which address one account is (E31). The narrow port, not
    // `UserProfileRepository`: that one can read and write a whole account,
    // and the module that owns accounts is the one that may (E33).
    @Inject(PROFILE_DIRECTORY)
    private readonly directory: ProfileDirectory,
    private readonly tokens: TokenSigner,
  ) {}

  async resolveClaim(
    claim: PluginRegistrationClaim,
    window: PluginRegistrationWindow,
  ): Promise<PluginRegistrationSlice> {
    return claim.kind === 'link'
      ? this.fromLink(claim.token, window)
      : this.fromAccount(claim.participantId, window);
  }

  async findRegistration(
    registrationId: string,
  ): Promise<PluginRegistration | null> {
    const registration = await this.registrations.findById(registrationId);
    // Confirmed only, here as in both reads above: a ticket whose registration
    // was cancelled resolves to nothing, and that is how a door closes behind
    // a cancellation without the plug-in owning the rule.
    return registration && registration.status === 'confirmed'
      ? toRegistration(registration)
      : null;
  }

  async findForEvent(
    eventId: string,
    window: PluginRegistrationWindow,
  ): Promise<PluginRegistrationSlice> {
    const slice = await this.registrations.search({
      eventId,
      // No search and no status choice: a door list is who is expected, and a
      // parameter for either would be a parameter a plug-in decides with.
      terms: [],
      status: 'confirmed',
      sort: 'name',
      direction: 'asc',
      offset: window.offset,
      limit: window.limit,
    });
    return toSlice(slice.rows, slice.total);
  }

  /**
   * The one registration a mailed link speaks for (E11, F44).
   *
   * Forged, expired, or pointing at a row that has since been deleted are one
   * answer — an empty slice — for the reason `SelfServiceService` gives: the
   * difference is not the holder's to learn, and it does not change what they
   * can do about it. A window past the first page is empty as well, because a
   * token speaks for one registration and page two of one row is no rows.
   */
  private async fromLink(
    token: string,
    window: PluginRegistrationWindow,
  ): Promise<PluginRegistrationSlice> {
    const id = this.tokens.verify('registration-self-service', token);
    if (!id) return EMPTY;

    const registration = await this.registrations.findById(id);
    if (!registration || registration.status !== 'confirmed') return EMPTY;

    const rows = window.offset === 0 ? [toRegistration(registration)] : [];
    return { rows, total: 1 };
  }

  /**
   * Every confirmed registration of one account, newest event first (E31).
   *
   * The address is resolved here and used here. An account that does not exist
   * — or whose double opt-in is outstanding — has no registrations to speak
   * for, which is the same empty answer a forged token gets: a session behind
   * the participant guard is always confirmed, so this branch is a race rather
   * than a state somebody reaches.
   */
  private async fromAccount(
    participantId: string,
    window: PluginRegistrationWindow,
  ): Promise<PluginRegistrationSlice> {
    const email = await this.directory.addressOf(participantId);
    if (!email) return EMPTY;

    const slice = await this.registrations.searchByAddress({
      email: email.trim().toLowerCase(),
      status: 'confirmed',
      offset: window.offset,
      limit: window.limit,
    });
    return toSlice(slice.rows, slice.total);
  }
}

const EMPTY: PluginRegistrationSlice = { rows: [], total: 0 };

function toSlice(
  rows: readonly RegistrationRecord[],
  total: number,
): PluginRegistrationSlice {
  return { rows: rows.map(toRegistration), total };
}

/**
 * Picked field by field rather than spread: the record carries the address, the
 * telephone number, the origin and the answers to the registration form, and
 * the contract promises none of them. What the contract does not name, a
 * plug-in must not receive.
 */
function toRegistration(row: RegistrationRecord): PluginRegistration {
  return {
    id: row.id,
    eventId: row.eventId,
    firstName: row.firstName,
    lastName: row.lastName,
    // Non-null through the status filter above and through the table's own
    // check constraint: a confirmed registration carries the instant (E32).
    confirmedAt: (row.confirmedAt ?? row.createdAt).toISOString(),
  };
}
