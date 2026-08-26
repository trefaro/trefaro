import { Module } from '@nestjs/common';

/**
 * External stream and media library links (FR 3.6, F10).
 *
 * Stores URLs per event and per programme item — streams, recordings and
 * materials — and nothing else: no upload, no transcoding (F10, variant a).
 * Phase 1.
 * This resolves the 'streaming' box of the thesis' building block view,
 * which the functional requirements never specified.
 *
 * Structure only at this point: phase 0 validates the architecture, it does not
 * implement features. Controllers, services and repository ports arrive with
 * the phase named above.
 */
@Module({})
export class MediaLinksModule {}
