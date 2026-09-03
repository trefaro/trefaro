export { AttachmentsModule } from './attachments.module';
export {
  AttachmentsService,
  type AttachmentDownload,
} from './attachments.service';
export {
  matchesSignature,
  signatureType,
  typesWithoutSignature,
} from './file-signature';
export { contentDisposition, safeFileName } from './file-name';
export { imageDimensions, type ImageDimensions } from './image-dimensions';
export type { UploadedFile } from './uploaded-file';
export {
  ATTACHMENT_REPOSITORY,
  type AttachmentRecord,
  type AttachmentRepository,
  type NewAttachment,
} from './ports/attachment.repository';
export {
  CONVERSATION_PURGE_REPOSITORY,
  type ConversationPurgeRepository,
  type UnownedFile,
} from './ports/conversation-purge.repository';
export { FILE_STORE, type FileArea, type FileStore } from './ports/file-store';
