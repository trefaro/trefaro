import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { RealtimeClient } from '@trefaro/shared-http';

/**
 * Whether new messages are arriving by themselves — said out loud (FR 4.5,
 * F110, NFR 10).
 *
 * The same honesty the offline banner applies to the network, applied to the
 * socket: a chat that has quietly lost its connection looks exactly like a
 * chat in which nobody is writing, and that is the one state a messenger must
 * not hide. So this says which of the two it is, on both chat screens, from
 * one place.
 *
 * It reports what it knows and nothing more. "Live" means the socket is
 * connected; it does not promise that this particular conversation is being
 * followed, which is a second question with a second answer — hence
 * {@link following}, which the thread screen passes and the list leaves unset.
 * A refused join is not an error either: the history on screen is complete,
 * it just stops growing (see `RealtimeClient.join`).
 */
@Component({
  selector: 'trefaro-live-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    <p class="live" role="status" [class.live--warn]="warns()">
      {{ key() | transloco }}
    </p>
  `,
  styles: `
    .live {
      margin: 0.2rem 0 0.8rem;
      font-size: 0.8rem;
      color: var(--trefaro-color-primary-muted);
    }

    .live--warn {
      color: var(--trefaro-color-primary-strong);
      font-weight: 600;
    }
  `,
})
export class LiveStatus {
  private readonly realtime = inject(RealtimeClient);

  /**
   * Whether the screen is following one conversation, or `null` where there is
   * none to follow.
   *
   * `false` while a connected socket is not in the conversation's room — which
   * happens after a refused join and after a reconnect that has not caught up
   * yet, and in both cases the lines on screen are the last ones this client
   * will see on its own.
   */
  readonly following = input<boolean | null>(null);

  protected readonly key = computed(() => {
    if (!this.realtime.isConnected()) {
      return this.realtime.status() === 'connecting'
        ? 'chat.live.connecting'
        : 'chat.live.off';
    }
    return this.following() === false
      ? 'chat.live.notFollowing'
      : 'chat.live.on';
  });

  protected readonly warns = computed(() => this.key() !== 'chat.live.on');
}
