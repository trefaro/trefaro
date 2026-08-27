export { AttachmentsModule } from './attachments.module';
export {
  AttachmentsService,
  type AttachmentDownload,
} from './attachments.service';
export { matchesSignature, typesWithoutSignature } from './file-signature';
export { contentDisposition, safeFileName } from './file-name';
export type { UploadedFile } from './uploaded-file';
export {
  ATTACHMENT_REPOSITORY,
  type AttachmentRecord,
  type AttachmentRepository,
  type NewAttachment,
} from './ports/attachment.repository';
export { FILE_STORE, type FileStore } from './ports/file-store';
