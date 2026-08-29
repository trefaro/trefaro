import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ConfigurationService } from './configuration.service';
import {
  AppConfigSettingsDto,
  UpdateAppConfigDto,
} from './dto/app-config-settings.dto';
import { LocaleSettingsDto } from './dto/locale-settings.dto';

/**
 * The instance's whitelabel settings, for the organizer client (FR 1.4).
 *
 * Behind the administrative session by virtue of its path (E16) — no decorator
 * to forget. Unlike `/api/config`, which every visitor reads, this is the
 * writing side and it answers with the *stored* values: the font as its
 * catalogue key rather than the expanded stack, because that is what the design
 * page sends back.
 *
 * No core module guard: an instance that could not be branded would be a
 * whitelabel application with its label switched off.
 */
@ApiTags('configuration')
@Controller('admin/config')
export class AdminConfigController {
  constructor(private readonly configuration: ConfigurationService) {}

  @Get()
  @ApiOperation({ summary: 'The whitelabel settings as they are stored' })
  @ApiOkResponse({ type: AppConfigSettingsDto })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  getSettings(): Promise<AppConfigSettingsDto> {
    return this.configuration.getSettings() as Promise<AppConfigSettingsDto>;
  }

  @Patch()
  @ApiOperation({
    summary: 'Change the name, the two brand colours or the font',
    description:
      'A `PATCH`: only what is sent gets written. Takes effect on the next ' +
      'load of either client — a running client does not repaint, because ' +
      'nothing pushes configuration to it (E20).',
  })
  @ApiOkResponse({ type: AppConfigSettingsDto })
  @ApiBadRequestResponse({
    description:
      'A colour that is not hexadecimal, a font this instance does not ship, ' +
      'or an empty name.',
  })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  update(@Body() body: UpdateAppConfigDto): Promise<AppConfigSettingsDto> {
    return this.configuration.updateSettings(
      body,
    ) as Promise<AppConfigSettingsDto>;
  }

  @Put('locales')
  @ApiOperation({
    summary:
      'Which languages the instance offers, and which one it defaults to',
    description:
      'Not part of the `PATCH` above: the design page must not be able to ' +
      'change the language of every outgoing mail by sending one more field. ' +
      'Written as a set, because the two values constrain each other — the ' +
      'default has to be one of the offered ones. English is added if it is ' +
      'left out (NFR 4, E23). Offering a barely translated language is ' +
      'allowed; removing one deletes no translation (E30).',
  })
  @ApiOkResponse({ type: LocaleSettingsDto })
  @ApiBadRequestResponse({
    description:
      'A tag that is not BCP 47, a default that is not among the active ' +
      'locales, an empty list, or more languages than one instance may offer.',
  })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  setLocales(@Body() body: LocaleSettingsDto): Promise<LocaleSettingsDto> {
    return this.configuration.setLocales(body) as Promise<LocaleSettingsDto>;
  }
}
