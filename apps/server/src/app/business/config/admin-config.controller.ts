import { Body, Controller, Get, Patch } from '@nestjs/common';
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
}
