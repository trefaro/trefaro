import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * One session somebody put in their own programme (FR 3.17).
 *
 * **The pair is the primary key.** A person has a session in their plan or they
 * do not; there is no second state and nothing to tell two rows apart, so a
 * surrogate id would only make "is it in?" a question with more than one
 * possible answer. The same shape `program_item_signup` has — and precisely
 * because the shape is the same, the difference has to be said out loud: this
 * table has **no capacity and no seat** (E55). Putting a session here reserves
 * nothing.
 *
 * Both foreign keys are real and both cascade. Deleting a session takes it out
 * of everybody's plan; deleting an account takes that person's plan with it,
 * which is what makes "delete my data" one statement rather than a routine
 * somebody has to remember. A plug-in's own table may declare that towards a
 * core table: it binds the plug-in, never the core (F21).
 *
 * No `updated_at`. There is exactly one write in this row's life — it is added
 * — and taking it out is deleting it.
 */
@Entity({ name: 'plugin_personal_program_entry' })
export class PlanEntryEntity {
  /** The account, which is what a participant's session resolves to. */
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @PrimaryColumn({ name: 'program_item_id', type: 'uuid' })
  programItemId!: string;

  /**
   * When it went in.
   *
   * Not shown anywhere today, and here anyway: a row without a time cannot
   * answer "since when" for a person who asks, and the column costs eight
   * bytes. It is never an ordering key — a programme is ordered by the clock
   * (F40), not by when somebody happened to tick a box.
   */
  @Column({ name: 'added_at', type: 'timestamptz' })
  addedAt!: Date;
}
