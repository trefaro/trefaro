import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../config';
import { ParticipantProfilesController } from './participant-profiles.controller';
import { ProfileSearchService } from './profile-search.service';

/**
 * Finding other participants (FR 4.4, UC 12) — AP 5 of phase 3.
 *
 * An optional core module of its own (E42, F53): `profile-search` decides
 * whether the people in an instance may find each other, `profiles` whether
 * there are accounts at all. It **requires** `profiles`, declared in the
 * descriptor and enforced by the module administration in both directions —
 * which is what lets the endpoints here check one flag instead of two.
 *
 * What this module does **not** import is `ProfilesModule`, although it reads
 * `user_profile`. Two reasons, and they are the same two the `ProfileDirectory`
 * port gives: `UserProfileRepository` can read a whole account and write to it,
 * which belongs to the module the accounts belong to (E33), and a directory
 * needs a read-only window on the rows that opted in. So there is a port of its
 * own, `SearchableProfileRepository`, whose statements cannot answer with a
 * hidden profile at all.
 *
 * The one thing it does take from `profiles` is `avatarUrl` — a pure function,
 * imported directly like every other shared function (F100). A second
 * construction of the same URL is exactly the drift F113 exists to prevent.
 *
 * `ConfigurationModule` for the module guard. Until AP 5 this file was
 * structure only: a module so the composition root and the layer boundaries
 * were in place before there was anything to put in them.
 */
@Module({
  imports: [ConfigurationModule],
  controllers: [ParticipantProfilesController],
  providers: [ProfileSearchService],
})
export class ProfileSearchModule {}
