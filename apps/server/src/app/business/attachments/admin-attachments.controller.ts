import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AttachmentsService } from './attachments.service';
import { contentDisposition } from './file-name';

/**
 * Downloading a file a participant uploaded (E9, FR 3.5).
 *
 * The only way to the bytes. The upload volume is not served statically and has
 * no public URL, because what a registration form collects can be a passport
 * scan or a visa application — and behind the administrative guard by virtue of
 * its path (E16), so no forgotten decorator can open it.
 *
 * Addressed by id and nothing else: the id is the only thing an organizer's list
 * holds, and a path in the URL would be an invitation to try another one.
 */
@ApiTags('attachments')
@Controller('admin/attachments')
export class AdminAttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get(':id')
  // The type is what the participant claimed and this server verified, but a
  // browser that sniffs its own answer would make that verification pointless.
  @Header('X-Content-Type-Options', 'nosniff')
  // Nothing in a downloaded document may load or run anything.
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  // A passport scan has no business in a shared cache.
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: 'Download an uploaded file',
    description:
      'Answers with the stored bytes as an attachment, under the name the ' +
      'participant uploaded it with. 404 both when there is no such ' +
      'attachment and when the volume no longer holds its file — from the ' +
      'outside the two are the same thing.',
  })
  @ApiOkResponse({
    description: 'The file.',
    content: {
      'application/octet-stream': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({ description: 'No such file.' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const file = await this.attachments.download(id);
    return new StreamableFile(file.bytes, {
      type: file.mimeType,
      disposition: contentDisposition(file.fileName),
      length: file.bytes.length,
    });
  }
}
