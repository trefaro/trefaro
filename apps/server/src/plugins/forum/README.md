# Discussion forum plug-in (FR 4.6, P2)

Participants talk with each other about an event: threads with posts, and a
decision per post before anything is published.

Built in **AP 4 and AP 5 of phase 4** — the server here, the web component in
`apps/plugins/forum`. **One bundle, two audiences**: the same element renders a
participant's forum at the `event-detail` hook point (the threads, one thread
with its posts, the two forms) and the organization's moderation section at
`event-dashboard`, and which of the two it is drawing arrives as `mountPoint`
in the slot context, because only the host knows (F202).

## Shape

Follows `../program-proposals`, the first plug-in of the phase: `api/` (two
controllers, one per access level), `business/` (service plus its repository
port), `data-access/` (two entities, one repository, one migration), one
`ServerPlugin` descriptor and `enabledByDefault: false`.

It owns exactly two tables, `plugin_forum_thread` and `plugin_forum_post`, and
touches no core table (F21). Five columns reference core tables — the event,
the opener, the author, whoever decided, and the post its thread — with real
foreign keys, which constrains the plug-in rather than the core.

## What it uses of plug-in API 1.2.0

| Needed                         | Reached through                                               |
| ------------------------------ | ------------------------------------------------------------- |
| Who is asking                  | `CurrentPluginParticipant`, `CurrentPluginOrganizer`          |
| What an author is called       | `PluginParticipantReads` (name and picture, no address — F55) |
| A prerequisite (`profiles`)    | `ServerPlugin.requires`                                       |
| The window of a paginated list | `pageWindow`, re-exported by the contract                     |
| Which screen is being drawn    | `PluginSlotContext.mountPoint` (client side, F202)            |
| Its words and its language     | `PluginSlotContext.strings` and `locale` (E48)                |

The same six things the proposals use, through the same port — and the port was
not changed for it. That was the proof AP 4 was meant to deliver.

## Decisions that are not obvious from the code

- **A thread has no status of its own** (F195). It is visible as soon as a post
  in it is approved — and to whoever wrote in it, whatever the status of what
  they wrote. The rule is **one** SQL clause used by the thread list, the post
  list and the reply (F152), so "not visible" and "not there" are the same 404
  and nobody can reply into a thread they cannot read.
- **`last_post_at` follows what is published.** The latest approved post, or
  the thread's creation while there is none, recomputed on every decision: a
  reader must not see a thread jump because of a post they cannot read, and a
  correction moves it back.
- **A decision is a route, not a field** (E51): `POST …/approval`,
  `POST …/rejection`, per post. A rejected post keeps its row (E14) and shows
  its status to its author and to the organization, to nobody else.
- **Whether an event is published or over is not checked.** The contract
  publishes no port for an event's state, and inventing the rule here would be a
  product decision taken inside a plug-in.
- **`…/summary` exists because a screen reads it** (E21). AP 4 deliberately left
  it unbuilt; AP 5 added it for the three counts above the queue in the section
  this plug-in draws on the organizer's dashboard. The **tile** above that
  section carries no number — that would be the host asking a plug-in a
  question (E59).
- **The thread list carries no post count.** A count of the posts a reader may
  see differs per reader — their own pending posts are in it, nobody else's —
  so it would be a number that means something different to each person
  looking at the same list. The thread itself is one tap away.
- **`created_by` cascades, with an open question.** Deleting an opener's account
  takes the whole thread, published replies of others included. Nothing can
  delete an account before phase 5; the decision is filed in `todo.md` there.
