import { FormControl, FormRecord } from '@angular/forms';
import type { AnswerableField, CustomFieldValue } from '@trefaro/shared-models';
import { MAX_CUSTOM_TEXT_LENGTH } from '@trefaro/shared-models';
import {
  fillAnswers,
  syncAnswers,
  validatorsFor,
  type AnswerRecord,
} from './field-answers';

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

function record(): AnswerRecord {
  return new FormRecord<FormControl<CustomFieldValue>>({});
}

describe('field answers', () => {
  describe('validatorsFor', () => {
    it('lets an optional question be left blank', () => {
      const control = new FormControl<CustomFieldValue>('', {
        nonNullable: true,
        validators: validatorsFor(field()),
      });

      expect(control.valid).toBe(true);
    });

    it('demands a tick rather than an answer for a required checkbox', () => {
      const validators = validatorsFor(
        field({ type: 'checkbox', required: true }),
      );
      const control = new FormControl<CustomFieldValue>(false, {
        nonNullable: true,
        validators,
      });

      expect(control.valid).toBe(false);
      control.setValue(true);
      expect(control.valid).toBe(true);
    });

    it('bounds a text answer, and only a text answer', () => {
      const text = new FormControl<CustomFieldValue>('', {
        nonNullable: true,
        validators: validatorsFor(field()),
      });
      text.setValue('x'.repeat(MAX_CUSTOM_TEXT_LENGTH + 1));
      expect(text.valid).toBe(false);

      // A choice is as long as the organizer wrote it; the length bound is
      // about what somebody types, not about what they pick.
      const choice = new FormControl<CustomFieldValue>('', {
        nonNullable: true,
        validators: validatorsFor(field({ type: 'select' })),
      });
      choice.setValue('x'.repeat(MAX_CUSTOM_TEXT_LENGTH + 1));
      expect(choice.valid).toBe(true);
    });
  });

  describe('syncAnswers', () => {
    it('builds one control per field, blank in the type of the field', () => {
      const answers = record();
      syncAnswers(answers, [
        field(),
        field({ key: 'code-of-conduct', type: 'checkbox' }),
      ]);

      expect(answers.getRawValue()).toEqual({
        'local-group': '',
        'code-of-conduct': false,
      });
    });

    it('keeps what has been typed when it runs again', () => {
      const answers = record();
      syncAnswers(answers, [field()]);
      answers.controls['local-group'].setValue('Cologne');

      syncAnswers(answers, [field(), field({ key: 'committee' })]);

      expect(answers.getRawValue()).toEqual({
        'local-group': 'Cologne',
        committee: '',
      });
    });

    it('drops the control of a question that is gone', () => {
      const answers = record();
      syncAnswers(answers, [field(), field({ key: 'committee' })]);

      syncAnswers(answers, [field()]);

      expect(Object.keys(answers.controls)).toEqual(['local-group']);
    });
  });

  describe('fillAnswers', () => {
    it('puts stored answers where they belong', () => {
      const fields = [
        field(),
        field({ key: 'code-of-conduct', type: 'checkbox' }),
      ];
      const answers = record();
      syncAnswers(answers, fields);

      fillAnswers(answers, fields, {
        'local-group': 'Cologne',
        'code-of-conduct': true,
      });

      expect(answers.getRawValue()).toEqual({
        'local-group': 'Cologne',
        'code-of-conduct': true,
      });
    });

    it('leaves an unanswered question blank rather than undefined', () => {
      const fields = [field({ type: 'checkbox' })];
      const answers = record();
      syncAnswers(answers, fields);
      answers.controls['local-group'].setValue(true);

      fillAnswers(answers, fields, {});

      expect(answers.getRawValue()).toEqual({ 'local-group': false });
    });

    it('ignores an answer whose type does not fit its field', () => {
      const fields = [field({ type: 'checkbox' })];
      const answers = record();
      syncAnswers(answers, fields);

      fillAnswers(answers, fields, { 'local-group': 'yes' });

      // Not coerced: "yes" in a checkbox is a question about how it got there,
      // and guessing would write the guess back on the next save.
      expect(answers.getRawValue()).toEqual({ 'local-group': false });
    });

    it('ignores an answer that outlived its question (F34)', () => {
      const fields = [field()];
      const answers = record();
      syncAnswers(answers, fields);

      // "committee" was deleted as a question; its answers are kept in the
      // profile and there is simply no input for them any more.
      fillAnswers(answers, fields, { committee: 'Board' });

      expect(Object.keys(answers.controls)).toEqual(['local-group']);
    });
  });
});
