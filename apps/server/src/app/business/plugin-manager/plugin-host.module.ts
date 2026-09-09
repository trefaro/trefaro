import { Global, Module } from '@nestjs/common';
import {
  PLUGIN_PARTICIPANT_READS,
  PLUGIN_PROGRAM_READS,
  PLUGIN_REGISTRATION_READS,
} from '../plugin-api';
import { ProfilePluginReads } from '../profiles/profile-plugin-reads';
import { ProgramPluginReads } from '../program/program-plugin-reads';
import { RegistrationPluginReads } from '../registration/registration-plugin-reads';
import { SecurityModule } from '../security';

/**
 * What the host offers its plug-ins (E12).
 *
 * The counterpart of {@link PluginManagerModule}: that one mounts plug-ins, this
 * one publishes the core capabilities they are allowed to read. Global, so a
 * plug-in injects a token from `plugin-api` and imports no core module — which is
 * the rule the plug-in contract rests on ("plug-ins import from `plugin-api` and
 * from nowhere else inside the server").
 *
 * Kept deliberately small. Every provider here is a promise the core has to keep
 * across versions, so a capability lands here only when a plug-in genuinely
 * cannot do its job without it — the room plan's overbooking check being the
 * first (F21, FR 3.10) and an author's name the second (E58, F55, AP 2 of
 * phase 4). Nothing here goes the other way: the host asks a plug-in nothing
 * (E59).
 *
 * It imports exactly one module, and `SecurityModule` is not a feature: it
 * holds the token signer and imports nothing itself, so it cannot close a
 * cycle. The registration adapter needs it because resolving a self-service
 * claim is checking a signature (E11) — and a second implementation of "is
 * this token valid" is the one that would outlive a rotated secret.
 *
 * It imports no feature module — deliberately, and once by accident not: the
 * programme adapter tried to reach `ProgramService` in AP 6, and
 * `PluginHostModule → ProgramModule → EventsModule → PushModule → …` closed a
 * cycle that left a module `undefined` at boot. The adapters read the ports of
 * the global data access module instead, which is what a host module for
 * plug-ins is: a seam over the data, not a client of the features.
 */
@Global()
@Module({
  imports: [SecurityModule],
  providers: [
    ProgramPluginReads,
    { provide: PLUGIN_PROGRAM_READS, useExisting: ProgramPluginReads },
    ProfilePluginReads,
    { provide: PLUGIN_PARTICIPANT_READS, useExisting: ProfilePluginReads },
    RegistrationPluginReads,
    {
      provide: PLUGIN_REGISTRATION_READS,
      useExisting: RegistrationPluginReads,
    },
  ],
  exports: [
    PLUGIN_PROGRAM_READS,
    PLUGIN_PARTICIPANT_READS,
    PLUGIN_REGISTRATION_READS,
  ],
})
export class PluginHostModule {}
