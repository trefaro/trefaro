# Discussion forum plug-in (FR 4.6, P2)

Not implemented yet — scheduled for **phase 4**.

One forum per event. A post is created but _not published_: the organizer
reviews it and approves or rejects it (UC 15). The survey's free-text feedback
was explicit that moderation effort has to stay minimal, so the approval flow is
a single decision per post, not a workflow.

Follows the structure of `../room-planning`, which is the reference
implementation of the plug-in contract: `api/`, `business/` and `data-access/`
inside the plug-in, one `ServerPlugin` descriptor, own entities, own migrations,
no core table touched.
