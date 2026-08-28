# shared-models

The contract between the server and both clients: the payload types of every
endpoint, plus the pure functions that must not be reimplemented per client —
formatting a time in an event's zone (E8), building a public event address
(`publicEventPath`), grouping a programme into days, deriving an invitation's
state from its counts.

Framework-free on purpose. It is the only shared library the **server** imports,
which is what makes a broken contract a build error rather than a failed request;
an Angular dependency here would end that.

```bash
nx test shared-models    # Jest — no browser environment needed
```
