import { Module } from '@nestjs/common';

/**
 * Finding other participants (UC 12).
 *
 * Search by name and further criteria (FR 4.4) over PostgreSQL full text
 * search — phase 3.
 * A profile appears in results only after its owner opted in (F13). This is
 * activist data: invisible is the default, findable is a decision.
 *
 * Structure only: the module exists so the composition root and the layer
 * boundaries are in place before there is anything to put in them. Controllers, services and repository ports arrive with
 * the phase named above.
 */
@Module({})
export class ProfileSearchModule {}
