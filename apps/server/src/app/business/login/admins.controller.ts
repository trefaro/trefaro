import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminUserService } from './admin-user.service';
import { CurrentAdmin } from './current-admin.decorator';
import { AdminAccountDto, toAdminAccountDto } from './dto/admin.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import type { AuthenticatedAdmin } from './ports/admin-session.repository';

/**
 * Administrator accounts (FR 1.2).
 *
 * Behind the administrative guard by virtue of its path — see
 * {@link AdminGuard}.
 */
@ApiTags('administration')
@Controller('admin/admins')
export class AdminsController {
  constructor(private readonly admins: AdminUserService) {}

  @Get()
  @ApiOperation({ summary: 'All administrator accounts' })
  @ApiOkResponse({ type: [AdminAccountDto] })
  async list(): Promise<AdminAccountDto[]> {
    const admins = await this.admins.list();
    return admins.map(toAdminAccountDto);
  }

  @Post()
  @ApiOperation({ summary: 'Create an administrator account' })
  @ApiCreatedResponse({ type: AdminAccountDto })
  @ApiConflictResponse({ description: 'The address is already in use.' })
  async create(@Body() body: CreateAdminDto): Promise<AdminAccountDto> {
    return toAdminAccountDto(await this.admins.create(body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an administrator account',
    description:
      'Ends its sessions immediately. Deleting your own account is ' +
      'refused, which also means an instance can never lose its last ' +
      'administrator.',
  })
  @ApiNoContentResponse({ description: 'Account deleted.' })
  @ApiConflictResponse({ description: 'You cannot delete your own account.' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() current: AuthenticatedAdmin,
  ): Promise<void> {
    await this.admins.delete(id, current.admin.id);
  }
}
