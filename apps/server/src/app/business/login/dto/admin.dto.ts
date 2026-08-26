import { ApiProperty } from '@nestjs/swagger';
import type { AdminAccount, AdminSessionInfo } from '@trefaro/shared-models';
import type { AdminSummary } from '../admin-user.service';

/**
 * OpenAPI shapes for the administrative endpoints.
 *
 * Each class `implements` the interface from `@trefaro/shared-models`, so the
 * documented API and the type the organizer client compiles against cannot
 * drift apart without breaking the build.
 */
export class AdminAccountDto implements AdminAccount {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'organizer@example.org' })
  email!: string;

  @ApiProperty({ example: 'Alex Weber' })
  name!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  lastLoginAt!: string | null;
}

export class AdminSessionInfoDto implements AdminSessionInfo {
  @ApiProperty({ type: AdminAccountDto })
  admin!: AdminAccountDto;

  @ApiProperty({
    format: 'date-time',
    description:
      'When the session lapses if it is not used. Every request slides it forward.',
  })
  expiresAt!: string;
}

export function toAdminAccountDto(admin: AdminSummary): AdminAccountDto {
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    createdAt: admin.createdAt.toISOString(),
    lastLoginAt: admin.lastLoginAt?.toISOString() ?? null,
  };
}
