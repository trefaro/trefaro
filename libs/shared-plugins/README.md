# shared-plugins

The client half of the plug-in mechanism: `PluginLoaderService` fetches the
bundles the configuration announced and registers their custom elements,
`<trefaro-plugin-slot>` is the mount point a page offers, and
`provideTrefaroPlugins()` wires both into an application.

The fifth shared library, beyond the four the original plan named — the loader and
the mount point fit into none of them. Inputs reach a plug-in as element
_properties_, not attributes: Angular Elements does not project object-typed
inputs through attributes, and a non-Angular plug-in reads properties the same
way.

```bash
nx test shared-plugins
```
