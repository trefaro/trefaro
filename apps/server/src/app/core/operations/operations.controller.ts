import { Controller, Get, Inject } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  DATABASE_HEALTH,
  type DatabaseHealth,
} from '../health/database-health.port';
import { OperationsReportDto } from './dto/operations-report.dto';
import { RuntimeMetricsService } from './runtime-metrics.service';

/** Bytes are a unit nobody reads; megabytes with one decimal are. */
function megabytes(bytes: number): number {
  return Math.round(bytes / 10_485.76) / 100;
}

/**
 * What an operator needs when an instance behaves strangely (NFR 10, NFR 11).
 *
 * `/api/health` answers "is it alive" to a proxy that cannot sign in. This
 * answers the next question — "and how has it been?" — and it is behind the
 * administrative guard by virtue of its path (E16), because the shape of an
 * instance's traffic is not a thing to publish.
 *
 * It reports numbers and never rows. The closest it comes to naming anything is
 * {@link RuntimeSnapshot.lastIncident}, and that carries a mark, a status and a
 * path whose query values are already gone — the handle for finding one entry
 * in the log, rather than a copy of it. Deliberately **not** a second log:
 * everything here is derived from what the process has counted since it came
 * up, and a restart empties it, which is honest because a restart is usually
 * the event somebody is asking about.
 *
 * No screen draws it. That is a decision, recorded in `todo.md` with what it
 * would cost: every one of some thirty pages in the organizer client renders a
 * failed request with its own markup, so putting an incident mark in front of a
 * person needs a shared banner first — and an operator is not always an
 * organizer anyway.
 */
@ApiTags('operations')
@Controller('admin/operations')
export class OperationsController {
  constructor(
    private readonly metrics: RuntimeMetricsService,
    @Inject(DATABASE_HEALTH) private readonly database: DatabaseHealth,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'How this instance has been since it came up',
    description:
      'Uptime, memory, whether the database answers and how quickly, what the ' +
      'answers have been, the last fault by its mark, and what has become of ' +
      'outgoing mail. Numbers only — the one string that identifies anything ' +
      'is the mark of the last fault, which is what makes that fault findable ' +
      'in the log without anything about the caller being written there.',
  })
  @ApiOkResponse({ type: OperationsReportDto })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  async report(): Promise<OperationsReportDto> {
    const latencyMs = await this.database.probe();
    const memory = process.memoryUsage();

    return {
      ...this.metrics.snapshot(),
      database: { reachable: latencyMs !== null, latencyMs },
      memory: {
        residentMb: megabytes(memory.rss),
        heapUsedMb: megabytes(memory.heapUsed),
      },
    };
  }
}
