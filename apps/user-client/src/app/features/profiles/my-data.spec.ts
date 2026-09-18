import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslationsForTest } from '@trefaro/shared-i18n';
import type { ParticipantAccountDeletion } from '@trefaro/shared-models';
import { ParticipantSessionService } from '../auth/participant-session.service';
import { MyData } from './my-data';
import { ParticipantProfileService } from './participant-profile.service';

interface Page {
  download: () => Promise<void>;
  remove: () => Promise<void>;
  cancel: () => void;
  confirming: { set: (value: boolean) => void; (): boolean };
  exportError: () => { key: string } | null;
  deleteError: () => { key: string } | null;
  form: { patchValue: (value: { password: string }) => void };
}

class FakeProfiles {
  archive: Blob | null = new Blob([new Uint8Array([0x50, 0x4b, 3, 4])]);
  exportFails: unknown = null;
  deleteFails: unknown = null;
  readonly deletions: ParticipantAccountDeletion[] = [];

  async exportArchive(): Promise<Blob> {
    if (this.exportFails) throw this.exportFails;
    if (!this.archive) throw new Error('no archive');
    return this.archive;
  }

  async deleteAccount(deletion: ParticipantAccountDeletion): Promise<void> {
    this.deletions.push(deletion);
    if (this.deleteFails) throw this.deleteFails;
  }
}

/**
 * Downloading everything, and closing the account (E65).
 *
 * Three decisions are worth a test here, and all three are about what happens
 * **after** a request: that a refused deletion leaves the session alone, that a
 * successful one ends it in this browser as well, and that a failed export
 * says so instead of handing the browser an empty file.
 */
describe('MyData', () => {
  let profiles: FakeProfiles;
  let cleared: number;
  let navigated: unknown[][];
  let objectUrls: number;

  async function render() {
    profiles = new FakeProfiles();
    cleared = 0;
    navigated = [];
    objectUrls = 0;

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslationsForTest({}),
        { provide: ParticipantProfileService, useValue: profiles },
        {
          provide: ParticipantSessionService,
          useValue: {
            clear: () => {
              cleared += 1;
            },
          },
        },
      ],
    });

    TestBed.inject(Router).navigate = async (commands: unknown[]) => {
      navigated.push(commands);
      return true;
    };

    // The anchor trick is the only way to name a fetched download; what this
    // spec checks is that it happened, not how a browser saves a file.
    URL.createObjectURL = () => {
      objectUrls += 1;
      return 'blob:archive';
    };
    URL.revokeObjectURL = () => undefined;

    const fixture = TestBed.createComponent(MyData);
    fixture.detectChanges();
    return {
      fixture,
      page: fixture.componentInstance as unknown as Page,
    };
  }

  it('hands the archive to the browser', async () => {
    const { page } = await render();

    await page.download();

    expect(objectUrls).toBe(1);
    expect(page.exportError()).toBeNull();
  });

  it('says so when the archive cannot be made, rather than saving nothing', async () => {
    const { page } = await render();
    profiles.exportFails = { status: 500 };

    await page.download();

    expect(objectUrls).toBe(0);
    expect(page.exportError()?.key).toBe('profile.myData.export.failed');
  });

  it('keeps the session when the password was not right', async () => {
    const { page } = await render();
    profiles.deleteFails = { status: 401 };
    page.confirming.set(true);
    page.form.patchValue({ password: 'not-the-passphrase' });

    await page.remove();

    expect(profiles.deletions).toEqual([{ password: 'not-the-passphrase' }]);
    expect(page.deleteError()?.key).toBe('profile.myData.delete.failed');
    expect(cleared).toBe(0);
    expect(navigated).toEqual([]);
  });

  it('ends the session in this browser too, and leaves the page', async () => {
    const { page } = await render();
    page.confirming.set(true);
    page.form.patchValue({ password: 'a-long-enough-passphrase' });

    await page.remove();

    // Not a logout call: there is no session left to end, and asking would
    // answer 401 into a page that is on its way out.
    expect(cleared).toBe(1);
    expect(navigated).toEqual([['/']]);
  });

  it('sends nothing at all while the password is empty', async () => {
    const { page } = await render();
    page.confirming.set(true);

    await page.remove();

    expect(profiles.deletions).toEqual([]);
  });
});
