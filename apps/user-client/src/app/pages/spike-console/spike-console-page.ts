import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { AppConfigService } from '@trefaro/shared-config';
import { RealtimeClient, type RealtimeEchoReply } from '@trefaro/shared-http';
import { PluginLoaderService } from '@trefaro/shared-plugins';
import { ThemeService } from '@trefaro/shared-theming';
import { PushSubscriptionService } from '../../features/push/push-subscription.service';

/**
 * Phase 0 diagnostics for the four architecture spikes.
 *
 * The spikes validate what the thesis itself names as its open risk — that the
 * plug-in mechanism works on both sides — plus Web Push and WebSockets through
 * the reverse proxy. Each of those is a claim about the running system, so this
 * page makes them checkable in a browser rather than only in unit tests.
 *
 * It doubles as an operator diagnostic: "is the theme applied, which plug-ins
 * loaded, does push work here, does the socket upgrade survive the proxy" are the
 * questions a self-hosting NGO will ask.
 */
@Component({
  selector: 'trefaro-spike-console-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <h1>Architecture spikes</h1>

    <section>
      <h2>1 · Configuration and theming</h2>
      @if (config.config(); as loaded) {
        <dl>
          <dt>Default locale</dt>
          <dd>{{ loaded.defaultLocale }}</dd>
          <dt>Available locales</dt>
          <dd>{{ loaded.availableLocales.join(', ') }}</dd>
          <dt>Enabled modules</dt>
          <dd>{{ loaded.enabledModules.join(', ') || 'none' }}</dd>
          <dt>Primary / accent</dt>
          <dd>
            <span class="swatch swatch--primary"></span>
            {{ theme.theme().primaryColor }}
            <span class="swatch swatch--accent"></span>
            {{ theme.theme().accentColor }}
          </dd>
        </dl>
      } @else {
        <p class="warn">
          Configuration not loaded — the client is running on its fallback
          theme.
        </p>
      }
    </section>

    <section>
      <h2>2 · Client plug-ins</h2>
      @for (result of plugins.loadResults(); track result.plugin.key) {
        <p>
          <code>{{ result.plugin.key }}</code>
          &rarr; {{ result.status }}
          @if (result.error) {
            <span class="warn">({{ result.error }})</span>
          }
          <br />
          <small
            >&lt;{{ result.plugin.elementName }}&gt; from
            {{ result.plugin.bundleUrl }}</small
          >
        </p>
      } @empty {
        <p>
          No plug-in is enabled. Switch one on under
          <code>Modules</code> in the organizer client and reload — the
          plug-in's tables already exist either way.
        </p>
      }
      <p>
        A mounted plug-in appears on an event detail view, for example
        <a href="/events/11111111-1111-4111-8111-111111111111"
          >/events/11111111-…</a
        >.
      </p>
    </section>

    <section>
      <h2>3 · Web Push</h2>
      <p>
        State: <strong>{{ push.state() }}</strong>
      </p>
      @switch (push.state()) {
        @case ('unsupported') {
          <p>
            No service worker is active. Angular registers it only in a
            production build, so push has to be tested against one.
          </p>
        }
        @case ('not-configured') {
          <p>
            This instance publishes no VAPID key, which has two possible reasons
            since phase 2: the <code>push</code> module is switched off (switch
            it on under <code>Modules</code> in the organizer client), or there
            is no key pair — generate one with
            <code>npx web-push generate-vapid-keys</code> and set
            <code>VAPID_PUBLIC_KEY</code> and <code>VAPID_PRIVATE_KEY</code>.
          </p>
        }
        @case ('denied') {
          <p>Notification permission was declined in this browser.</p>
        }
        @default {
          <button
            type="button"
            [disabled]="!push.canSubscribe()"
            (click)="subscribe()"
          >
            Subscribe this browser
          </button>
          @if (push.state() === 'subscribed') {
            <button type="button" (click)="unsubscribe()">Unsubscribe</button>
          }
        }
      }
      @if (push.error(); as error) {
        <p class="warn">{{ error }}</p>
      }
    </section>

    <section>
      <h2>4 · WebSocket through the proxy</h2>
      <p>
        Status: <strong>{{ realtime.status() }}</strong>
        @if (realtime.transport(); as transport) {
          on transport <strong>{{ transport }}</strong>
        }
      </p>
      <button type="button" (click)="realtime.connect()">Connect</button>
      <button
        type="button"
        [disabled]="!realtime.isConnected()"
        (click)="sendEcho()"
      >
        Send echo
      </button>
      <button type="button" (click)="realtime.disconnect()">Disconnect</button>
      @if (echoReply(); as reply) {
        <p>
          Reply &ldquo;{{ reply.text }}&rdquo; at {{ reply.serverTime }} over
          <strong>{{ reply.transport }}</strong> (socket {{ reply.socketId }})
        </p>
      }
      @if (echoError(); as error) {
        <p class="warn">{{ error }}</p>
      }
      @if (realtime.error(); as error) {
        <p class="warn">{{ error }}</p>
      }
    </section>
  `,
  styles: `
    section {
      margin-block: 1.5rem;
      padding-block-end: 1rem;
      border-block-end: 1px solid var(--trefaro-color-primary-muted);
    }

    h2 {
      font-size: 1rem;
    }

    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.2rem 0.75rem;
      font-size: 0.9rem;
    }

    dt {
      font-weight: 600;
    }

    dd {
      margin: 0;
    }

    .swatch {
      display: inline-block;
      inline-size: 0.9rem;
      block-size: 0.9rem;
      border-radius: 0.2rem;
      vertical-align: middle;
      margin-inline-end: 0.2rem;
    }

    .swatch--primary {
      background: var(--trefaro-color-primary);
    }

    .swatch--accent {
      background: var(--trefaro-color-accent);
    }

    .warn {
      color: #a3341f;
    }

    button {
      margin-inline-end: 0.5rem;
      border: none;
      border-radius: 0.4rem;
      padding: 0.4rem 0.8rem;
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
      cursor: pointer;
    }

    button[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
})
export class SpikeConsolePage {
  protected readonly config = inject(AppConfigService);
  protected readonly theme = inject(ThemeService);
  protected readonly plugins = inject(PluginLoaderService);
  protected readonly push = inject(PushSubscriptionService);
  protected readonly realtime = inject(RealtimeClient);

  protected readonly echoReply = signal<RealtimeEchoReply | null>(null);
  protected readonly echoError = signal<string | null>(null);

  protected subscribe(): void {
    void this.push.subscribe();
  }

  protected unsubscribe(): void {
    void this.push.unsubscribe();
  }

  protected async sendEcho(): Promise<void> {
    this.echoError.set(null);
    try {
      this.echoReply.set(
        await this.realtime.echo('hello from the participant client'),
      );
    } catch (error) {
      this.echoReply.set(null);
      this.echoError.set(
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
