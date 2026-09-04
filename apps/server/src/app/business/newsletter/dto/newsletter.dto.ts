import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  NewsletterConfirmation,
  NewsletterSignupAcknowledgement,
  NewsletterSignupRequest,
} from '@trefaro/shared-models';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class NewsletterSignupDto implements NewsletterSignupRequest {
  @ApiProperty({ example: 'amina@example.org' })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiPropertyOptional({
    example: 'buergerraete',
    description:
      'The series this sign-up is about. Omitted means the whole instance — ' +
      'which is what the form on the start page sends.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  seriesSlug?: string;
}

export class NewsletterSignupAcknowledgementDto implements NewsletterSignupAcknowledgement {
  @ApiProperty({
    example: 'amina@example.org',
    description:
      'The address the sign-up was for — the whole answer, whatever the ' +
      'state of that address already was (E45, E32).',
  })
  email!: string;
}

export class ConfirmNewsletterDto {
  @ApiProperty({
    description: 'The `token` query parameter of the mailed link.',
  })
  @IsString()
  @Length(1, 1024)
  token!: string;
}

export class NewsletterConfirmationDto implements NewsletterConfirmation {
  @ApiProperty({ enum: ['confirmed', 'already-confirmed'] })
  state!: NewsletterConfirmation['state'];
}
