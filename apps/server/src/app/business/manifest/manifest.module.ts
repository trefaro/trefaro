import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../config';
import { I18nModule } from '../i18n';
import { WebManifestController } from './web-manifest.controller';
import { WebManifestService } from './web-manifest.service';

/**
 * The installable participant client's manifest (F20, E26).
 *
 * A composition module over the configuration and the catalogue, in the shape
 * F49 established: whoever needs two things that already depend on each other
 * sits above both. Putting this endpoint in `ConfigurationModule` — where its
 * URL suggests it belongs — would make the configuration depend on the
 * catalogue, which depends on the configuration.
 *
 * It exports nothing. One document, one reader, and that reader is a browser.
 */
@Module({
  imports: [ConfigurationModule, I18nModule],
  controllers: [WebManifestController],
  providers: [WebManifestService],
})
export class ManifestModule {}
