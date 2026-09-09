import { TestBed } from '@angular/core/testing';
import { OrganizerDoor } from './organizer-door';
import { QrCheckinApi } from './qr-checkin-api';
import {
  CODE,
  FakeApi,
  STRINGS,
  all,
  buttons,
  one,
  page,
  result,
  row,
  settle,
  settleUntil,
  submit,
  textOf,
  unknownCode,
} from './testing';

/**
 * The door (FR 3.16, F199) — the half a suite can prove.
 *
 * A camera needs a device, so what is checked here is everything around it:
 * the field, the button in every row, the two answers a code can get, and the
 * list that shows the state afterwards. That this half stands on its own is
 * the decision, not a limitation of the test.
 */
describe('OrganizerDoor', () => {
  let api: FakeApi;

  async function render(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      providers: [{ provide: QrCheckinApi, useValue: api }],
    });
    const fixture = TestBed.createComponent(OrganizerDoor);
    fixture.componentRef.setInput('eventId', 'event-1');
    fixture.componentRef.setInput('strings', STRINGS);
    fixture.componentRef.setInput('locale', 'de');
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    await settle(fixture);
    return fixture;
  }

  /** Types a code into the field and submits the form, the way a person does. */
  async function typeIn(
    fixture: { nativeElement: unknown; detectChanges(): void },
    code: string,
  ): Promise<void> {
    const field = one(fixture, 'input') as HTMLInputElement;
    field.value = code;
    submit(one(fixture, 'form') as HTMLFormElement);
    await settle(fixture);
  }

  beforeEach(() => {
    api = new FakeApi();
    api.admissionPages = [page([row()])];
  });

  it('lists who is expected, by name, with their state', async () => {
    api.admissionPages = [
      page([
        row({ registrationId: 'a', firstName: 'Amina', lastName: 'Okonkwo' }),
        row({
          registrationId: 'b',
          firstName: 'Bo',
          lastName: 'Zhang',
          checkedInAt: '2027-06-14T07:12:00.000Z',
        }),
      ]),
    ];

    const fixture = await render();

    // Trimmed: two interpolations either side of a comma get wrapped by the
    // formatter, and `textContent` keeps the indentation that comes with it.
    expect(
      all(fixture, '.list__name').map((cell) => cell.textContent?.trim()),
    ).toEqual(['Okonkwo, Amina', 'Zhang, Bo']);
    expect(all(fixture, '.list__state')[0].textContent).toContain(
      STRINGS['waiting'],
    );
    expect(all(fixture, '.list__state')[1].textContent).toContain(
      STRINGS['checkedIn'],
    );
  });

  it('sends the row’s own code when the button beside it is pressed (F199)', async () => {
    const fixture = await render();

    buttons(fixture, STRINGS['admit'])
      .filter((button) => button.type === 'button')[0]
      .click();
    await settle(fixture);

    expect(api.scans).toEqual([CODE]);
  });

  it('sends a typed code without the gaps it was printed with', async () => {
    // The characters are shown in groups so somebody can read them out; the
    // person retyping them types the gaps too.
    const fixture = await render();

    await typeIn(fixture, 'k7qf 3m2x 9tvb 4nd8 rj0h c5wg yp');

    expect(api.scans).toEqual(['k7qf3m2x9tvb4nd8rj0hc5wgyp']);
  });

  it('names the person and marks their row, without reloading the list', async () => {
    const fixture = await render();
    const readsBefore = api.admissionReads.length;

    await typeIn(fixture, CODE);

    expect(one(fixture, '.verdict')?.textContent).toContain('Amina');
    expect(one(fixture, '.verdict')?.textContent).toContain(
      STRINGS['admitted'],
    );
    expect(one(fixture, '.list__state')?.textContent).toContain(
      STRINGS['checkedIn'],
    );
    // Somebody is standing in front of the screen: the list keeps its place.
    expect(api.admissionReads.length).toBe(readsBefore);
  });

  it('answers a second scan with “already here since …”, not with an error (E53)', async () => {
    api.scanAnswer = result({ alreadyCheckedIn: true });

    const fixture = await render();
    await typeIn(fixture, CODE);

    const verdict = one(fixture, '.verdict');
    expect(verdict?.textContent).toContain(STRINGS['alreadyHere']);
    expect(verdict?.textContent).toMatch(/\d{1,2}[:.]\d{2}/);
    expect(verdict?.classList.contains('verdict--no')).toBe(false);
    expect(textOf(fixture)).not.toContain(STRINGS['error']);
  });

  it('says a code opens nothing, and says nothing about who is expected', async () => {
    api.scanAnswer = unknownCode();

    const fixture = await render();
    await typeIn(fixture, 'NOPE');

    expect(one(fixture, '.verdict--no')?.textContent).toContain(
      STRINGS['unknownCode'],
    );
    expect(textOf(fixture)).not.toContain(STRINGS['error']);
  });

  it('empties the field after an admission and keeps what was typed after a refusal', async () => {
    const fixture = await render();

    await typeIn(fixture, CODE);
    expect((one(fixture, 'input') as HTMLInputElement).value).toBe('');

    api.scanAnswer = unknownCode();
    await typeIn(fixture, 'NOPE');
    // Nothing was written, so nothing may look written: the next attempt is a
    // correction rather than a retype.
    expect((one(fixture, 'input') as HTMLInputElement).value).toBe('NOPE');
  });

  it('sends nothing for an empty field', async () => {
    const fixture = await render();

    await typeIn(fixture, '   ');

    expect(api.scans).toEqual([]);
  });

  it('shows no button for a row that is already in', async () => {
    api.admissionPages = [
      page([row({ checkedInAt: '2027-06-14T07:12:00.000Z' })]),
    ];

    const fixture = await render();

    expect(
      buttons(fixture, STRINGS['admit']).filter(
        (button) => button.type === 'button',
      ),
    ).toHaveLength(0);
  });

  it('appends the next page rather than replacing what is on screen', async () => {
    api.admissionPages = [
      page([row({ registrationId: 'a', lastName: 'Okonkwo' })], {
        total: 2,
        pageSize: 1,
      }),
      page([row({ registrationId: 'b', lastName: 'Zhang' })], {
        total: 2,
        page: 2,
        pageSize: 1,
      }),
    ];

    const fixture = await render();
    buttons(fixture, STRINGS['more'])[0].click();
    await settle(fixture);

    expect(all(fixture, '.list__name')).toHaveLength(2);
    expect(api.admissionReads.map((read) => read.page)).toEqual([1, 2]);
    expect(buttons(fixture, STRINGS['more'])).toHaveLength(0);
  });

  it('says so when nobody has registered yet', async () => {
    api.admissionPages = [page([])];

    const fixture = await render();

    expect(textOf(fixture)).toContain(STRINGS['emptyList']);
    expect(one(fixture, '.list')).toBeNull();
  });

  it('reports a list it could not read, and still offers the field', async () => {
    api.admissionPages = [];

    const fixture = await render();

    expect(textOf(fixture)).toContain(STRINGS['error']);
    expect(one(fixture, 'input')).not.toBeNull();
  });

  it('offers no camera button where the browser has no camera (F199)', async () => {
    // jsdom has no `mediaDevices`, which is also a door on a desktop machine:
    // the field and the list are the whole screen, and nothing apologizes.
    const fixture = await render();

    expect(buttons(fixture, STRINGS['startCamera'])).toHaveLength(0);
    expect(one(fixture, 'input')).not.toBeNull();
  });

  it('offers the camera where there is one, and falls back to the field when it is refused', async () => {
    const mediaDevices = {
      getUserMedia: () => Promise.reject(new Error('NotAllowedError')),
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: mediaDevices,
    });
    try {
      const fixture = await render();
      const camera = buttons(fixture, STRINGS['startCamera']);
      expect(camera).toHaveLength(1);

      camera[0].click();
      await settleUntil(fixture, STRINGS['cameraFailed']);

      expect(textOf(fixture)).toContain(STRINGS['cameraFailed']);
      // And the door still works, which is the whole of F199.
      await typeIn(fixture, CODE);
      expect(api.scans).toEqual([CODE]);
    } finally {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: undefined,
      });
    }
  });
});
