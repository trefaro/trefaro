import { escapeHtml } from './html';
import { MissingMailTextError, mailStrings } from './strings';

describe('mailStrings', () => {
  const strings = (
    values: Record<string, string>,
    keys = Object.keys(values),
  ) => mailStrings('de', keys, values);

  it('fills placeholders in both renderings', () => {
    const s = strings({ 'mail.greeting': 'Hallo {{name}},' });

    expect(s.text('mail.greeting', { name: 'Amina' })).toBe('Hallo Amina,');
    expect(s.html('mail.greeting', { name: escapeHtml('Amina') })).toBe(
      'Hallo Amina,',
    );
  });

  it('tolerates the spacing a translator may type', () => {
    const s = strings({ 'mail.greeting': 'Hallo {{ name }},' });

    expect(s.text('mail.greeting', { name: 'Amina' })).toBe('Hallo Amina,');
  });

  it('escapes the catalogue text, not just the values', () => {
    // An organization writes its own sentences (E22), so the sentence is
    // untrusted input too — not only the participant's name inside it.
    const s = strings({ 'mail.receipt.closing': 'Bis <bald> & tschüss' });

    expect(s.html('mail.receipt.closing')).toBe(
      'Bis &lt;bald&gt; &amp; tschüss',
    );
  });

  it('escapes a value exactly once', () => {
    const s = strings({ 'mail.greeting': 'Hallo {{name}},' });

    expect(s.html('mail.greeting', { name: escapeHtml('A & B') })).toBe(
      'Hallo A &amp; B,',
    );
  });

  it('leaves a placeholder nobody supplied standing', () => {
    // The opposite of what Transloco does on a screen, and deliberate: a mail
    // cannot be reloaded, so a visible `{{tage}}` is something a recipient can
    // report and an empty gap is not.
    const s = strings({ 'mail.confirm.validity': 'Gültig für {{tage}} Tage.' });

    expect(s.text('mail.confirm.validity', { days: 14 })).toBe(
      'Gültig für {{tage}} Tage.',
    );
  });

  it('refuses to bind a key the resolution never produced', () => {
    // Not a missing translation — a broken image. The catalogue that reaches
    // here has already been through the English fallback, so a gap means the
    // shipped English file has no such key.
    expect(() => mailStrings('en', ['mail.greeting'], {})).toThrow(
      MissingMailTextError,
    );
  });

  it('names the keys it is missing', () => {
    try {
      mailStrings('en', ['mail.greeting', 'mail.receipt.closing'], {
        'mail.greeting': 'Hello {{name}},',
      });
      fail('expected a MissingMailTextError');
    } catch (error) {
      expect(error).toBeInstanceOf(MissingMailTextError);
      expect((error as MissingMailTextError).keys).toEqual([
        'mail.receipt.closing',
      ]);
    }
  });

  it('reports the language it is written in', () => {
    expect(strings({ 'mail.greeting': 'Hallo,' }).locale).toBe('de');
  });
});
