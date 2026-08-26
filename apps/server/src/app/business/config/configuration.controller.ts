import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigurationService } from './configuration.service';
import { AppConfigDto } from './dto/app-config.dto';

/**
 * Public configuration endpoint (FR 1.4, FR 1.5).
 *
 * Deliberately outside the `/api/user` and `/api/admin` namespaces: both
 * clients need it, and they need it before anyone has logged in.
 */
@ApiTags('configuration')
@Controller('config')
export class ConfigurationController {
  constructor(private readonly configuration: ConfigurationService) {}

  @Get()
  @ApiOperation({
    summary: 'Theme, locales and enabled modules of this instance',
    description:
      'Fetched by both clients on startup, before the theme is applied and the ' +
      'plug-in web components are loaded. Requires no authentication.',
  })
  @ApiOkResponse({ type: AppConfigDto })
  getAppConfig(): Promise<AppConfigDto> {
    return this.configuration.getAppConfig() as Promise<AppConfigDto>;
  }
}
