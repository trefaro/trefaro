import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/**
 * The signed link's token, as a request body (E11).
 *
 * In the body and not in the query for everything that *changes* something —
 * the same reason confirming is a POST rather than a GET (E5b): a mail scanner
 * or a link previewer that fetches URLs must not be able to claim a seat, and a
 * credential that lands in an access log on every click is one that lives in
 * logs. The read is the exception: it is what the link in the mail does, so its
 * token is in the URL because the link already is.
 */
export class SelfServiceTokenDto {
  @ApiProperty({
    description: 'The token from the personal link in the confirmation mail.',
  })
  @IsString()
  // Bounded on both ends: a token this class produced is well over 60
  // characters, and an unbounded string is an unbounded HMAC computation.
  @Length(20, 1024)
  token!: string;
}
