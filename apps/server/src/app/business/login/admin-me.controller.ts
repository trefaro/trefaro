import { Body, Controller, HttpCode, HttpStatus, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminUserService } from './admin-user.service';
import { CurrentAdmin } from './current-admin.decorator';
import { ChangeAdminPasswordDto } from './dto/change-admin-password.dto';
import type { AuthenticatedAdmin } from './ports/admin-session.repository';

/**
 * What an organizer may do to their **own** account (AP 9 of phase 5).
 *
 * Its own controller rather than a fourth route on `admin/admins`, and the
 * address is the argument: `admin/admins/:id` is the list of colleagues, where
 * the subject is somebody else and the id comes out of a table. Here the
 * subject is the session, there is no id, and nothing in here may ever take
 * one — a password change that accepted an id would be one missing check away
 * from letting an organizer set a colleague's password. The participant client
 * makes the same distinction with `participant/me` (E34), for the same reason.
 *
 * Behind the administrative guard by virtue of its path (E16).
 */
@ApiTags('administration')
@Controller('admin/me')
export class AdminMeController {
  constructor(private readonly admins: AdminUserService) {}

  @Put('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Change my own password',
    description:
      'With the current one, which is what makes this a change and not a ' +
      'reset: whoever is holding this session may have found the screen ' +
      'unlocked. Every **other** session of this account ends afterwards. ' +
      'There is no reset counterpart — an organizer who is locked out is let ' +
      'back in by another organizer.',
  })
  @ApiNoContentResponse({ description: 'Changed; other sessions ended.' })
  @ApiBadRequestResponse({
    description:
      'The new password is shorter or longer than the policy allows.',
  })
  @ApiUnauthorizedResponse({
    description: 'No valid session, or the current password is not right.',
  })
  async changePassword(
    @CurrentAdmin() current: AuthenticatedAdmin,
    @Body() body: ChangeAdminPasswordDto,
  ): Promise<void> {
    await this.admins.changePassword(current, body);
  }
}
