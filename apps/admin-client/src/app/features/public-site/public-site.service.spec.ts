import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AppConfigService } from '@trefaro/shared-config';
import { describe, expect, it } from 'vitest';
import { PublicSite } from './public-site.service';

function setUp(origin: string) {
  const url = signal(origin);
  TestBed.configureTestingModule({
    providers: [
      { provide: AppConfigService, useValue: { publicUserClientUrl: url } },
    ],
  });
  return { site: TestBed.inject(PublicSite), url };
}

describe('PublicSite', () => {
  it('joins the deployment origin to the public path of an event', () => {
    const { site } = setUp('https://events.example.org');

    expect(site.event('assemblies', 'session-3')).toBe(
      'https://events.example.org/series/assemblies/events/session-3',
    );
    expect(site.series('assemblies')).toBe(
      'https://events.example.org/series/assemblies',
    );
  });

  it('does not double the slash on a configured origin that ends in one', () => {
    // A trailing slash in an operator's `.env` is the normal kind of typo, and
    // `//series/…` is read as a protocol-relative URL to the host `series` by
    // some proxies — which is a link that leaves the instance entirely.
    const { site } = setUp('https://events.example.org/');

    expect(site.event('assemblies', 'session-3')).toBe(
      'https://events.example.org/series/assemblies/events/session-3',
    );
  });

  it('says it does not know the origin before the configuration has arrived', () => {
    // The alternative to an origin is not a shorter link but a wrong one: a
    // bare `/series/…` resolves against the organizer client's own origin,
    // which serves a completely different application. A screen asks first.
    const { site, url } = setUp('');

    expect(site.known()).toBe(false);

    url.set('http://localhost:4200');
    expect(site.known()).toBe(true);
  });
});
