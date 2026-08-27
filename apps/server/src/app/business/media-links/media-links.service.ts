import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  MediaLink,
  MediaLinkChange,
  MediaLinkInput,
  PublicMediaLink,
} from '@trefaro/shared-models';
import {
  MAX_MEDIA_LINKS_PER_EVENT,
  MAX_MEDIA_LINK_TITLE_LENGTH,
  MAX_MEDIA_LINK_URL_LENGTH,
  isWebUrl,
  sortMediaLinks,
} from '@trefaro/shared-models';
import { EventsService } from '../events';
import { ProgramService } from '../program';
import {
  MEDIA_LINK_REPOSITORY,
  type MediaLinkChanges,
  type MediaLinkRecord,
  type MediaLinkRepository,
} from './ports/media-link.repository';

/** Said the same way wherever a link cannot be found any more. */
const GONE = 'This media link no longer exists.';

/**
 * External stream, recording and material links of an event (FR 3.6, F10).
 *
 * This is the "streaming" module of the thesis' building block view, settled by
 * F10 as variant (a): the instance *refers* to media somebody else hosts. What
 * that rules out is most of what a media module usually does — there is no
 * upload, no transcoding, no player, and nothing here ever asks the target what
 * it is called (F51). An organizer types a title and a URL.
 *
 * Four rules:
 *
 * 1. **Only `http` and `https`.** A `javascript:` URL in an `href` is a script a
 *    visitor runs by clicking a link the organizer typed, and a bare word
 *    resolves against this instance and renders as a broken page. Checked here
 *    as well as in the DTO, because a second entry point must not be able to
 *    store what the first refuses.
 * 2. **A session's link belongs to the session's event.** Refused with 400 — the
 *    database refuses it too, through a composite foreign key, but a constraint
 *    violation would reach the organizer as a 500.
 * 3. **The order is the kind, then the order they were added** (F52). Applied
 *    here rather than in SQL, because the sequence of the kinds is a product
 *    decision and lives with them in `shared-models`.
 * 4. **A ceiling per event**, so a scripted mistake cannot fill the table. Not a
 *    limit anybody is meant to reach.
 *
 * Whether this module answers at all is decided elsewhere: `media-links` is an
 * optional core module (FR 1.5), and its controllers sit behind
 * `CoreModuleEnabledGuard`, which makes a switched-off module answer 404 (F53).
 */
@Injectable()
export class MediaLinksService {
  constructor(
    @Inject(MEDIA_LINK_REPOSITORY)
    private readonly links: MediaLinkRepository,
    private readonly events: EventsService,
    // To check that a session belongs to the event a link is being added to.
    // Through the programme's own service, so its 404 rule stays in one place.
    private readonly program: ProgramService,
  ) {}

  /** Every link of one event, as the organizer manages them. */
  async listForOrganizer(eventId: string): Promise<readonly MediaLink[]> {
    // Resolving the event first turns an unknown id into a 404 rather than an
    // empty list, which would read as "this event has no links".
    await this.events.getForOrganizer(eventId);
    return sortMediaLinks(await this.links.findByEvent(eventId)).map(
      toMediaLink,
    );
  }

  /**
   * The links a participant reads on the landing page (FR 3.6).
   *
   * Through the public event lookup, so the links of a draft event — or of an
   * event in a series nobody can see — are not readable either. Unlike the
   * follow-up text, a link is public the moment it exists: the organizer decides
   * when a recording is ready by adding it, and a stream URL is needed *before*
   * the event, which is exactly when the follow-up must still be invisible (F50).
   */
  async listPublic(
    seriesSlug: string,
    eventSlug: string,
  ): Promise<readonly PublicMediaLink[]> {
    const event = await this.events.getPublic(seriesSlug, eventSlug);
    return sortMediaLinks(await this.links.findByEvent(event.id)).map(
      toPublicMediaLink,
    );
  }

  async create(eventId: string, input: MediaLinkInput): Promise<MediaLink> {
    await this.events.getForOrganizer(eventId);

    const existing = await this.links.findByEvent(eventId);
    if (existing.length >= MAX_MEDIA_LINKS_PER_EVENT) {
      throw new ConflictException(
        `An event holds at most ${MAX_MEDIA_LINKS_PER_EVENT} media links. ` +
          'Remove one before adding another.',
      );
    }

    return toMediaLink(
      await this.links.create({
        eventId,
        programItemId: await this.session(eventId, input.programItemId ?? null),
        kind: input.kind,
        title: this.title(input.title),
        url: this.url(input.url),
      }),
    );
  }

  /**
   * Changes a link — anything about it.
   *
   * Nothing is fixed after creation: no answer, seat or file refers to a media
   * link, so a recording that turns out to sit at another URL is one edit rather
   * than a delete and a re-create.
   */
  async update(id: string, change: MediaLinkChange): Promise<MediaLink> {
    const existing = await this.require(id);

    const changes: MediaLinkChanges = {
      ...(change.kind === undefined ? {} : { kind: change.kind }),
      ...(change.title === undefined
        ? {}
        : { title: this.title(change.title) }),
      ...(change.url === undefined ? {} : { url: this.url(change.url) }),
      ...(change.programItemId === undefined
        ? {}
        : {
            // Against the link's own event, never a caller's word for it: the
            // link cannot move between events, so this is the only event it can
            // be checked against.
            programItemId: await this.session(
              existing.eventId,
              change.programItemId,
            ),
          }),
    };

    const updated = await this.links.update(id, changes);
    if (!updated) throw new NotFoundException(GONE);
    return toMediaLink(updated);
  }

  /**
   * Removes a link.
   *
   * No archiving and no confirmation rule of its own (unlike an event, E14): a
   * link is a pointer, and removing it takes nothing away from anybody — the
   * media it pointed at is not ours in the first place (F10).
   */
  async delete(id: string): Promise<void> {
    if (!(await this.links.delete(id))) throw new NotFoundException(GONE);
  }

  private async require(id: string): Promise<MediaLinkRecord> {
    const found = await this.links.findById(id);
    if (!found) throw new NotFoundException(GONE);
    return found;
  }

  /**
   * The session a link hangs on, checked against the event it hangs in.
   *
   * `null` passes straight through: that is a link belonging to the whole event,
   * which is the normal case.
   */
  private async session(
    eventId: string,
    programItemId: string | null,
  ): Promise<string | null> {
    if (programItemId === null) return null;

    const item = await this.program.getForOrganizer(programItemId);
    if (item.eventId !== eventId) {
      throw new BadRequestException(
        'A media link can only be attached to a session of its own event.',
      );
    }
    return item.id;
  }

  private title(value: string): string {
    const title = value.trim();
    if (title.length === 0) {
      throw new BadRequestException(
        'A media link needs a title participants read — the instance never ' +
          'asks the target what it is called.',
      );
    }
    if (title.length > MAX_MEDIA_LINK_TITLE_LENGTH) {
      throw new BadRequestException(
        `A title is at most ${MAX_MEDIA_LINK_TITLE_LENGTH} characters long.`,
      );
    }
    return title;
  }

  private url(value: string): string {
    const url = value.trim();
    if (!isWebUrl(url)) {
      throw new BadRequestException(
        'A media link has to be an http or https address — that is what a ' +
          'participant can be sent to by clicking it.',
      );
    }
    if (url.length > MAX_MEDIA_LINK_URL_LENGTH) {
      throw new BadRequestException(
        `An address is at most ${MAX_MEDIA_LINK_URL_LENGTH} characters long.`,
      );
    }
    return url;
  }
}

function toPublicMediaLink(record: MediaLinkRecord): PublicMediaLink {
  return {
    id: record.id,
    kind: record.kind,
    title: record.title,
    url: record.url,
    programItemId: record.programItemId,
  };
}

function toMediaLink(record: MediaLinkRecord): MediaLink {
  return {
    ...toPublicMediaLink(record),
    eventId: record.eventId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
