import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/**
 * The token from the objection link, as a request body (E5b, F58).
 *
 * In the body rather than in the query, for the same reason confirming a
 * registration is a POST: a mail scanner or a link previewer that fetches every
 * URL in a message must not be able to record an objection nobody made. The
 * direction of that mistake would be the harmless one — somebody would stop
 * receiving invitations they never asked to stop — but it would still be the
 * server deciding something the reader did not.
 */
export class InvitationOptOutDto {
  @ApiProperty({
    description: 'The token from the objection link in the invitation.',
  })
  @IsString()
  // Bounded on both ends: a token this class produced is well over 60
  // characters, and an unbounded string is an unbounded HMAC computation.
  @Length(20, 1024)
  token!: string;
}
