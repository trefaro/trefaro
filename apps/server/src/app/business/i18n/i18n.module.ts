import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../config';
import { CatalogueService } from './catalogue.service';
import { I18nAdminController } from './i18n-admin.controller';
import { I18nController } from './i18n.controller';
import { TranslationAdminService } from './translation-admin.service';

/**
 * Multilingual user interface text (chapter 4, E22-E24).
 *
 * Imports the configuration module because a language is servable if the
 * organization offers it, and that is a value in `app_config`. The dependency
 * runs one way only: the configuration knows nothing about catalogues.
 *
 * Not an optional core module. NFR 4 makes multilingualism a requirement rather
 * than a feature, and a switch that turned the interface's own text off would
 * leave both clients rendering their keys.
 *
 * Exports {@link CatalogueService} for AP 10, where the four mails stop carrying
 * their text in TypeScript and start reading it from here — with the whole-mail
 * fallback of E24 layered on top of the per-key chain.
 */
@Module({
  imports: [ConfigurationModule],
  controllers: [I18nController, I18nAdminController],
  providers: [CatalogueService, TranslationAdminService],
  exports: [CatalogueService],
})
export class I18nModule {}
