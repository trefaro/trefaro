import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
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
 * questions a self-hosting NGO will ask. Which is why its prose is in the
 * catalogue like every other page of this client (AP 8 of phase 2) — the
 * operator of a German instance is a German speaker. What stays untranslated is
 * everything that is an identifier rather than a sentence: a module key, a
 * variable name, a command to run, and the raw state words of the push and
 * socket clients, which are values to report rather than words to read.
 */
@Component({
  selector: 'trefaro-spike-console-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    <h1>{{ 'diagnostics.title' | transloco }}</h1>

    <section>
      <h2>1 · {{ 'diagnostics.config.title' | transloco }}</h2>
      @if (config.config(); as loaded) {
        <dl>
          <dt>{{ 'diagnostics.config.defaultLocale' | transloco }}</dt>
          <dd>{{ loaded.defaultLocale }}</dd>
          <dt>{{ 'diagnostics.config.availableLocales' | transloco }}</dt>
          <dd>{{ loaded.availableLocales.join(', ') }}</dd>
          <dt>{{ 'diagnostics.config.enabledModules' | transloco }}</dt>
          <dd>
            {{
              loaded.enabledModules.join(', ') ||
                ('diagnostics.config.none' | transloco)
            }}
          </dd>
          <dt>{{ 'diagnostics.config.colors' | transloco }}</dt>
          <dd>
            <span class="swatch swatch--primary"></span>
            {{ theme.theme().primaryColor }}
            <span class="swatch swatch--accent"></span>
            {{ theme.theme().accentColor }}
          </dd>
        </dl>
      } @else {
        <p class="warn">{{ 'diagnostics.config.notLoaded' | transloco }}</p>
      }
    </section>

    <section>
      <h2>2 · {{ 'diagnostics.plugins.title' | transloco }}</h2>
      @for (result of plugins.loadResults(); track result.plugin.key) {
        <p>
          <code>{{ result.plugin.key }}</code>
          &rarr; {{ result.status }}
          @if (result.error) {
            <span class="warn">({{ result.error }})</span>
          }
          <br />
          <small>{{
            'diagnostics.plugins.element'
              | transloco
                : {
                    element: result.plugin.elementName,
                    url: result.plugin.bundleUrl,
                  }
          }}</small>
        </p>
      } @empty {
        <p>{{ 'diagnostics.plugins.none' | transloco }}</p>
      }
      <p>
        {{ 'diagnostics.plugins.whereMounted' | transloco }}
        <a href="/events/11111111-1111-4111-8111-111111111111"
          >/events/11111111-…</a
        >
      </p>
    </section>

    <section>
      <h2>3 · {{ 'diagnostics.push.title' | transloco }}</h2>
      <p>
        {{ 'diagnostics.push.state' | transloco }}
        <strong>{{ push.state() }}</strong>
      </p>
      @switch (push.state()) {
        @case ('unsupported') {
          <p>{{ 'diagnostics.push.unsupported' | transloco }}</p>
        }
        @case ('not-configured') {
          <p>
            {{ 'diagnostics.push.notConfigured' | transloco }}
            <code>npx web-push generate-vapid-keys</code>,
            <code>VAPID_PUBLIC_KEY</code>, <code>VAPID_PRIVATE_KEY</code>
          </p>
        }
        @case ('denied') {
          <p>{{ 'diagnostics.push.denied' | transloco }}</p>
        }
        @default {
          <button
            type="button"
            [disabled]="!push.canSubscribe()"
            (click)="subscribe()"
          >
            {{ 'diagnostics.push.subscribe' | transloco }}
          </button>
          @if (push.state() === 'subscribed') {
            <button type="button" (click)="unsubscribe()">
              {{ 'diagnostics.push.unsubscribe' | transloco }}
            </button>
          }
        }
      }
      @if (push.error(); as error) {
        <p class="warn">{{ error }}</p>
      }
    </section>

    <section>
      <h2>4 · {{ 'diagnostics.socket.title' | transloco }}</h2>
      <p>
        {{ 'diagnostics.socket.status' | transloco }}
        <strong>{{ realtime.status() }}</strong>
        @if (realtime.transport(); as transport) {
          {{ 'diagnostics.socket.onTransport' | transloco }}
          <strong>{{ transport }}</strong>
        }
      </p>
      <button type="button" (click)="realtime.connect()">
        {{ 'diagnostics.socket.connect' | transloco }}
      </button>
      <button
        type="button"
        [disabled]="!realtime.isConnected()"
        (click)="sendEcho()"
      >
        {{ 'diagnostics.socket.echo' | transloco }}
      </button>
      <button type="button" (click)="realtime.disconnect()">
        {{ 'diagnostics.socket.disconnect' | transloco }}
      </button>
      @if (echoReply(); as reply) {
        <p>
          {{
            'diagnostics.socket.reply'
              | transloco
                : {
                    text: reply.text,
                    time: reply.serverTime,
                    transport: reply.transport,
                    socket: reply.socketId,
                  }
          }}
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
