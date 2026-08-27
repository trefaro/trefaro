import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type { AttachmentSummary } from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * Downloading a file a participant uploaded (E9, FR 3.5).
 *
 * Fetched and handed to the browser rather than linked to: the upload volume is
 * never served statically, and the bytes come through the administrative session
 * like every other read of participant data. A plain link would also lose the
 * original file name, which is the only thing that says whose document it is.
 */
@Injectable({ providedIn: 'root' })
export class AttachmentsAdminService {
  private readonly api = inject(ApiClient);

  async save(attachment: AttachmentSummary): Promise<void> {
    const blob = await firstValueFrom(
      this.api.file(`admin/attachments/${attachment.id}`),
    );
    this.offer(blob, attachment.fileName);
  }

  /**
   * Hands a downloaded blob to the browser under the right name.
   *
   * A temporary anchor, because there is no other way to name a download from
   * a fetched response. The object URL is released a moment later: releasing it
   * in the same tick cancels the download in some browsers.
   */
  private offer(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
