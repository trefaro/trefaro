/**
 * Server communication shared by both clients.
 *
 * The architecture rule names "HTTP communication" as a shared library; the
 * socket.io client lives here too, because from a client's point of view both
 * are the same concern — how it talks to its server.
 */
export { API_BASE_URL } from './lib/api-base-url';
export {
  ApiClient,
  type QueryParams,
  type RequestHeaders,
} from './lib/api-client.service';
export { toApiError, type ApiError } from './lib/api-error';
export {
  RealtimeClient,
  type RealtimeEchoReply,
  type RealtimeStatus,
} from './lib/realtime/realtime-client.service';
