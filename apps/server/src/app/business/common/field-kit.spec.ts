import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  MAX_CUSTOM_TEXT_LENGTH,
  MAX_FIELD_OPTIONS,
} from '@trefaro/shared-models';
import {
  checkAnswer,
  fieldLabel,
  firstFreeFieldKey,
  optionalHelpText,
  requestedFieldKey,
  selectOptions,
  unknownFieldKeys,
} from './field-kit';

/**
 * The rules both field kits obey (E35).
 *
 * `RegistrationFieldsService` and `ProfileFieldsService` each walk these
 * through their own endpoints, so what this file adds is the two things a
 * service-level test cannot reach: the bounds nobody sends by hand, and the
 * proof that the answer check is one function rather than two that agree today.
 */
describe('the shared field kit', () => {
  describe('checkAnswer', () => {
    const text = {
      label: 'Notes',
      type: 'text',
      options: [],
      required: false,
    } as const;

    it('treats an unanswered and an emptily answered field as the same thing (F36)', () => {
      expect(checkAnswer(text, undefined)).toBeUndefined();
      expect(checkAnswer(text, '   ')).toBeUndefined();
    });

    it('trims what it stores', () => {
      expect(checkAnswer(text, '  Cologne  ')).toBe('Cologne');
    });

    it('holds the text bound the column is sized for', () => {
      expect(
        checkAnswer(text, 'a'.repeat(MAX_CUSTOM_TEXT_LENGTH)),
      ).toHaveLength(MAX_CUSTOM_TEXT_LENGTH);
      expect(() =>
        checkAnswer(text, 'a'.repeat(MAX_CUSTOM_TEXT_LENGTH + 1)),
      ).toThrow(BadRequestException);
    });

    it('wants a checkbox ticked when it is required, not merely answered', () => {
      const consent = {
        label: 'Code of conduct',
        type: 'checkbox',
        options: [],
        required: true,
      } as const;

      expect(checkAnswer(consent, true)).toBe(true);
      expect(() => checkAnswer(consent, false)).toThrow(BadRequestException);
      expect(() => checkAnswer(consent, undefined)).toThrow(
        BadRequestException,
      );
    });

    it('keeps a "no" that nobody insisted on', () => {
      const optional = {
        label: 'Newsletter',
        type: 'checkbox',
        options: [],
        required: false,
      } as const;

      // `false` is an answer; it is stored, unlike an empty string.
      expect(checkAnswer(optional, false)).toBe(false);
    });

    it('accepts only a choice the definition offers', () => {
      const select = {
        label: 'Region',
        type: 'select',
        options: ['Europe', 'East Africa'],
        required: false,
      } as const;

      expect(checkAnswer(select, ' Europe ')).toBe('Europe');
      expect(() => checkAnswer(select, 'Antarctica')).toThrow(
        BadRequestException,
      );
    });

    it('refuses a value of the wrong shape in either direction', () => {
      expect(() => checkAnswer(text, true)).toThrow(BadRequestException);
      expect(() =>
        checkAnswer(
          {
            label: 'Newsletter',
            type: 'checkbox',
            options: [],
            required: false,
          },
          'yes',
        ),
      ).toThrow(BadRequestException);
    });
  });

  describe('keys', () => {
    it('derives a key from a label, and takes a given one literally', () => {
      expect(requestedFieldKey(undefined, 'Local group', [], 'a profile')).toBe(
        'local-group',
      );
      expect(
        requestedFieldKey('crm-member-id', 'Member number', [], 'a profile'),
      ).toBe('crm-member-id');
    });

    it('refuses a given key that is not a key', () => {
      expect(() =>
        requestedFieldKey('Not A Key', 'Anything', [], 'a profile'),
      ).toThrow(BadRequestException);
    });

    it('names who owns a reserved key, because two kits reserve different ones', () => {
      expect(() =>
        requestedFieldKey(undefined, 'Email', ['email'], 'the registration'),
      ).toThrow(/the registration already calls/);
      expect(() =>
        requestedFieldKey(undefined, 'Email', ['email'], 'a profile'),
      ).toThrow(/a profile already calls/);
    });

    it('numbers around a collision and gives up rather than looping forever', () => {
      expect(firstFreeFieldKey(['diet'], 'diet')).toBe('diet-2');
      expect(firstFreeFieldKey([], '')).toBe('field');

      const everything = [
        'diet',
        ...Array.from({ length: 49 }, (_, index) => `diet-${index + 2}`),
      ];
      expect(() => firstFreeFieldKey(everything, 'diet')).toThrow(
        ConflictException,
      );
    });
  });

  describe('labels, help texts and choices', () => {
    it('trims a label and refuses an empty one, naming who reads it', () => {
      expect(fieldLabel('  Local group  ', 'participants')).toBe('Local group');
      expect(() => fieldLabel('   ', 'participants')).toThrow(
        /a label participants read/,
      );
    });

    it('turns an emptied help text into no help text', () => {
      expect(optionalHelpText('  ')).toBeNull();
      expect(optionalHelpText(null)).toBeNull();
      expect(optionalHelpText(' Only if you are in one. ')).toBe(
        'Only if you are in one.',
      );
    });

    it('drops duplicate choices and refuses an empty or overlong list', () => {
      expect(selectOptions(true, [' Europe ', 'Europe', 'Asia'])).toEqual([
        'Europe',
        'Asia',
      ]);
      expect(() => selectOptions(true, ['  '])).toThrow(BadRequestException);
      expect(() =>
        selectOptions(
          true,
          Array.from({ length: MAX_FIELD_OPTIONS + 1 }, (_, i) => `${i}`),
        ),
      ).toThrow(BadRequestException);
      expect(() => selectOptions(false, ['yes'])).toThrow(BadRequestException);
      expect(selectOptions(false, [])).toEqual([]);
    });
  });

  it('reports the keys nothing asked for, in the order they were sent', () => {
    expect(
      unknownFieldKeys({ diet: 'vegan', colour: 'red' }, new Set(['diet'])),
    ).toEqual(['colour']);
  });
});
