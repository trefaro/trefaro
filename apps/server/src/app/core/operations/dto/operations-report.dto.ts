import { ApiProperty } from '@nestjs/swagger';
import type {
  IncidentNote,
  MailTally,
  RequestTally,
} from '../runtime-metrics.service';

class DatabaseReachabilityDto {
  @ApiProperty() reachable!: boolean;
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Round trip of a `SELECT 1`, or null when it did not come back.',
  })
  latencyMs!: number | null;
}

class MemoryDto {
  @ApiProperty({ description: 'Resident set size of the process.' })
  residentMb!: number;
  @ApiProperty() heapUsedMb!: number;
}

class RequestTallyDto implements RequestTally {
  @ApiProperty() succeeded!: number;
  @ApiProperty({ description: '400 to 499, except 429.' })
  clientErrors!: number;
  @ApiProperty({ description: 'Refused by a rate limit (E60).' })
  throttled!: number;
  @ApiProperty() serverErrors!: number;
}

class IncidentNoteDto implements IncidentNote {
  @ApiProperty({ description: 'The mark that also stands in the log line.' })
  incident!: string;
  @ApiProperty() at!: string;
  @ApiProperty() status!: number;
  @ApiProperty({ description: 'Query values are already removed.' })
  path!: string;
}

class MailTallyDto implements MailTally {
  @ApiProperty() sent!: number;
  @ApiProperty() failed!: number;
  @ApiProperty({ type: String, nullable: true }) lastFailureAt!: string | null;
}

/** The shape of `GET /api/admin/operations`. */
export class OperationsReportDto {
  @ApiProperty() startedAt!: string;
  @ApiProperty() uptimeSeconds!: number;
  @ApiProperty({ type: DatabaseReachabilityDto })
  database!: DatabaseReachabilityDto;
  @ApiProperty({ type: MemoryDto }) memory!: MemoryDto;
  @ApiProperty({ type: RequestTallyDto }) requests!: RequestTallyDto;
  @ApiProperty({ type: IncidentNoteDto, nullable: true })
  lastIncident!: IncidentNoteDto | null;
  @ApiProperty({ type: MailTallyDto }) mail!: MailTallyDto;
}
