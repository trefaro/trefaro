import { ApiProperty } from '@nestjs/swagger';
import {
  MAX_PROPOSAL_DESCRIPTION_LENGTH,
  MAX_PROPOSAL_PAGE_SIZE,
  MAX_PROPOSAL_TITLE_LENGTH,
  PROPOSAL_STATUSES,
  type NewProgramProposal,
  type ProgramProposal,
  type ProposalAuthor,
  type ProposalPage,
  type ProposalQuery,
  type ProposalStatus,
} from '@trefaro/shared-models';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * The payloads of the programme proposals plug-in.
 *
 * Each one implements the interface of the same name in `shared-models`: a
 * client that loads this plug-in's bundle shares the models with it, so a change
 * to the shape breaks a build rather than a request.
 */
export class ProposalAuthorDto implements ProposalAuthor {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    example: 'Amina Okonkwo',
    description:
      'First and last name in one string. Never an address — a plug-in is not ' +
      'a way around F55.',
  })
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  avatarUrl!: string | null;
}

export class ProgramProposalDto implements ProgramProposal {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  eventId!: string;

  @ApiProperty({ example: 'A workshop on election observation' })
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({
    enum: PROPOSAL_STATUSES,
    description:
      'Three states and no process (E51). A rejected proposal keeps its row ' +
      'and stays visible to the person who submitted it (FR 3.14).',
  })
  status!: ProposalStatus;

  @ApiProperty({
    nullable: true,
    type: ProposalAuthorDto,
    description:
      '`null` when the account behind the proposal is gone — not an anonymous ' +
      'proposal, and deliberately not a placeholder name.',
  })
  author!: ProposalAuthor | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'date-time',
    description: '`null` while it is pending; the two cannot drift apart.',
  })
  decidedAt!: string | null;
}

export class ProposalPageDto implements ProposalPage {
  @ApiProperty({ type: [ProgramProposalDto] })
  rows!: readonly ProgramProposalDto[];

  @ApiProperty({
    description: 'What the pages divide, not this page’s length.',
  })
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

/** What a participant sends to propose a session (FR 3.13). */
export class NewProgramProposalDto implements NewProgramProposal {
  @ApiProperty({
    maxLength: MAX_PROPOSAL_TITLE_LENGTH,
    example: 'A workshop on election observation',
  })
  @IsString()
  @Length(1, MAX_PROPOSAL_TITLE_LENGTH)
  title!: string;

  @ApiProperty({
    maxLength: MAX_PROPOSAL_DESCRIPTION_LENGTH,
    description: 'What the session would be about — a proposal is an argument.',
  })
  @IsString()
  @Length(1, MAX_PROPOSAL_DESCRIPTION_LENGTH)
  description!: string;
}

/**
 * What a list may be asked for.
 *
 * `status` only ever narrows the moderation list; the participant's list is
 * narrowed by the rule of E51 instead, which is in the statement rather than in
 * a query parameter — a client could not be trusted to ask for "approved plus
 * mine", and a client that asked for something else would be asking to see a
 * stranger's rejected proposal.
 */
export class ProposalQueryDto implements ProposalQuery {
  @ApiProperty({ required: false, enum: PROPOSAL_STATUSES })
  @IsOptional()
  @IsIn(PROPOSAL_STATUSES)
  status?: ProposalStatus;

  @ApiProperty({ required: false, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, minimum: 1, maximum: MAX_PROPOSAL_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PROPOSAL_PAGE_SIZE)
  pageSize?: number;
}
