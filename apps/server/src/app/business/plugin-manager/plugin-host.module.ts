import { Global, Module } from '@nestjs/common';
import { PLUGIN_PARTICIPANT_READS, PLUGIN_PROGRAM_READS } from '../plugin-api';
import { ProfilePluginReads } from '../profiles/profile-plugin-reads';
import { ProgramPluginReads } from '../program/program-plugin-reads';

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
 */
@Global()
@Module({
  providers: [
    ProgramPluginReads,
    { provide: PLUGIN_PROGRAM_READS, useExisting: ProgramPluginReads },
    ProfilePluginReads,
    { provide: PLUGIN_PARTICIPANT_READS, useExisting: ProfilePluginReads },
  ],
  exports: [PLUGIN_PROGRAM_READS, PLUGIN_PARTICIPANT_READS],
})
export class PluginHostModule {}
