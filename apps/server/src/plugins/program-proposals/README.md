# Programme proposals plug-in (FR 3.13, FR 3.14, P2)

Participants suggest programme items; the organizer approves or rejects, and the
status stays visible to the person who submitted it.

Built in **AP 2 of phase 4** — the server half. The web component, its mount
points (`event-detail`, `event-dashboard`) and its icon arrive in AP 3, which is
why the descriptor carries no `client` contribution yet: a bundle URL with
nothing behind it is a load failure reported to an organizer as a broken
plug-in.

## Shape

Follows `../room-planning`, the reference implementation of the plug-in
contract: `api/` (two controllers, one per access level), `business/` (service
plus its repository port), `data-access/` (entity, repository, migration), one
`ServerPlugin` descriptor and `enabledByDefault: false`.

It owns exactly one table, `plugin_program_proposals_proposal`, and touches no
core table (F21). Three of its columns reference core tables — the event, the
author, and whoever decided — with real foreign keys, which constrains the
plug-in rather than the core.

## What it uses of plug-in API 1.2.0

| Needed                         | Reached through                                               |
| ------------------------------ | ------------------------------------------------------------- |
| Who is asking                  | `CurrentPluginParticipant`, `CurrentPluginOrganizer`          |
| What an author is called       | `PluginParticipantReads` (name and picture, no address — F55) |
| A prerequisite (`profiles`)    | `ServerPlugin.requires`                                       |
| The window of a paginated list | `pageWindow`, re-exported by the contract                     |

## Decisions that are not obvious from the code

- **A rejected proposal is not deleted** (E14) and is visible to exactly two
  parties: its author and the organization. That rule lives in the repository's
  SQL, not in a caller (F152).
- **An approved proposal does not become a programme item** (E52). Approval
  publishes it; creating the session stays the organizer's action in the
  programme editor.
- **A decision is a route, not a field** (E51): `POST …/approval`,
  `POST …/rejection`. Re-deciding is allowed and moves the instant — a
  correction, not a state machine.
- **Whether an event is published or over is not checked.** The contract
  publishes no port for an event's state, and inventing the rule here would be a
  product decision taken inside a plug-in.
