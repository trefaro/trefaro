import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ModuleAdminService } from './module-admin.service';
import { ModuleSummaryDto, ToggleModuleDto } from './dto/module.dto';

/**
 * Module and plug-in administration (FR 1.5, UC 1).
 *
 * Behind the administrative session by virtue of its path (E16). Not behind a
 * core module guard of its own: the switch that turns modules off cannot be one
 * of the things that can be turned off.
 *
 * Deliberately not nested under `/api/admin/config`, although the flags are
 * configuration: the design settings are one row of values a `PATCH` replaces,
 * these are many rows with one flag each, addressed by key. One endpoint for both
 * would need a merge rule for a list.
 */
@ApiTags('configuration')
@Controller('admin/modules')
export class AdminModulesController {
  constructor(private readonly modules: ModuleAdminService) {}

  @Get()
  @ApiOperation({
    summary: 'Every switchable core module and curated plug-in, with its state',
    description:
      'Core modules first, then the plug-ins in the image — enabled or not. ' +
      '`/api/config` carries only the enabled ones, which is what a client ' +
      'needs; a page whose job is switching the others on needs all of them.',
  })
  @ApiOkResponse({ type: ModuleSummaryDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  list(): readonly ModuleSummaryDto[] {
    return this.modules.list() as readonly ModuleSummaryDto[];
  }

  @Patch(':key')
  @ApiOperation({
    summary: 'Switch one module on or off',
    description:
      'Writes the flag and re-reads it before answering, so the effect is ' +
      'immediate rather than up to fifteen seconds later (F6). Switching a ' +
      'module off deletes nothing — its tables and rows stay, and switching it ' +
      'on again brings them back.',
  })
  @ApiParam({ name: 'key', example: 'room-planning' })
  @ApiOkResponse({ type: ModuleSummaryDto })
  @ApiBadRequestResponse({
    description: '`enabled` is missing or not boolean.',
  })
  @ApiNotFoundResponse({
    description: 'No module of that key ships in this image.',
  })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  update(
    @Param('key') key: string,
    @Body() body: ToggleModuleDto,
  ): Promise<ModuleSummaryDto> {
    return this.modules.setEnabled(
      key,
      body.enabled,
    ) as Promise<ModuleSummaryDto>;
  }
}
