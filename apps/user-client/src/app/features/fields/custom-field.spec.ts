import { FormControl } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { provideTranslationsForTest } from '@trefaro/shared-i18n';
import type { AnswerableField, CustomFieldValue } from '@trefaro/shared-models';
import { CustomField } from './custom-field';

/** Throws rather than asserting non-null: a missing input is the failure. */
function inputIn(host: HTMLElement): HTMLInputElement {
  const input = host.querySelector('input');
  if (!input) throw new Error('the component drew no input');
  return input;
}

function field(overrides: Partial<AnswerableField> = {}): AnswerableField {
  return {
    key: 'local-group',
    label: 'Local group',
    type: 'text',
    helpText: null,
    options: [],
    required: false,
    ...overrides,
  };
}

/**
 * The one component both field kits are drawn by (E35).
 *
 * Rendered with a bare control and no form around it, which is the point of
 * handing the control in: what this component does must not depend on where it
 * was placed.
 */
describe('CustomField', () => {
  function render(
    definition: AnswerableField,
    value: CustomFieldValue = definition.type === 'checkbox' ? false : '',
  ) {
    TestBed.configureTestingModule({
      providers: [
        provideTranslationsForTest({ 'fields.choose': 'Please choose' }),
      ],
    });
    const control = new FormControl<CustomFieldValue>(value, {
      nonNullable: true,
    });
    const fixture = TestBed.createComponent(CustomField);
    fixture.componentRef.setInput('field', definition);
    fixture.componentRef.setInput('control', control);
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    return { fixture, control, host, text: () => host.textContent ?? '' };
  }

  it('draws a text question as a text input carrying the label', () => {
    const { host, control } = render(field());

    const input = inputIn(host);
    expect(input.type).toBe('text');
    expect(host.querySelector('label span')?.textContent).toBe('Local group');

    input.value = 'Cologne';
    input.dispatchEvent(new Event('input'));
    expect(control.value).toBe('Cologne');
  });

  it('marks a required question with an asterisk', () => {
    const { host } = render(field({ required: true }));

    expect(host.querySelector('label span')?.textContent).toBe('Local group *');
  });

  it('offers the choices of a select, behind an empty first option', () => {
    const { host } = render(
      field({ type: 'select', options: ['Bonn', 'Kiel'] }),
    );

    const options = [...host.querySelectorAll('option')].map((option) => [
      option.value,
      option.textContent,
    ]);
    expect(options).toEqual([
      ['', 'Please choose'],
      ['Bonn', 'Bonn'],
      ['Kiel', 'Kiel'],
    ]);
  });

  it('draws a checkbox with the question beside it, not above it', () => {
    const { host, control } = render(field({ type: 'checkbox' }));

    const input = inputIn(host);
    expect(input.type).toBe('checkbox');
    expect(host.querySelector('.check')).not.toBeNull();

    input.checked = true;
    input.dispatchEvent(new Event('change'));
    expect(control.value).toBe(true);
  });

  it('ties the explanation to the input rather than leaving it beside it', () => {
    const { host } = render(
      field({ helpText: 'So we can put you in touch locally.' }),
    );

    const hint = host.querySelector('small');
    expect(hint?.textContent?.trim()).toBe(
      'So we can put you in touch locally.',
    );
    expect(host.querySelector('input')?.getAttribute('aria-describedby')).toBe(
      hint?.id,
    );
  });

  it('describes nothing when there is no explanation', () => {
    const { host } = render(field());

    expect(host.querySelector('small')).toBeNull();
    expect(host.querySelector('input')?.hasAttribute('aria-describedby')).toBe(
      false,
    );
  });
});
