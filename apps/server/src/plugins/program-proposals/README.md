# Programme proposals plug-in (FR 3.13, FR 3.14, P2)

Participants suggest programme items; the organizer approves or rejects, and the
status stays visible to the person who submitted it.

Built in **AP 2 and AP 3 of phase 4** — the server here, the web component in
`apps/plugins/program-proposals`. **One bundle, two audiences**: the same
element renders a participant's panel at the `event-detail` hook point and the
organization's moderation section at `event-dashboard`, and which of the two it
is drawing arrives as `mountPoint` in the slot context, because only the host
knows (F202).

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
| Which screen is being drawn    | `PluginSlotContext.mountPoint` (client side, F202)            |
| Its words and its language     | `PluginSlotContext.strings` and `locale` (E48)                |

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
- **`…/summary` exists because a screen reads it** (E21). AP 2 deliberately left
  it unbuilt; AP 3 added it for the three counts above the queue in the section
  this plug-in draws on the organizer's dashboard. The **tile** above that
  section carries no number — that would be the host asking a plug-in a
  question (E59).
