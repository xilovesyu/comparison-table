# Node Search and Documentation Examples

## Interaction

Every expandable property row exposes a search action. Activating it reveals a local query field that filters only that row's descendant tree. A non-empty local query automatically expands the searched subtree; it is independent from the global table search.

## Rendering

Object and array cells use concise structural summaries instead of JavaScript stringification. Primitive renderers are unchanged.

## Examples

The demo becomes a documentation-style gallery with standalone cards for basic recursion, global and local search, selection rules, path-level presentation overrides, renderer configuration, controlled expansion, and arrays/missing fields.

## Tests

Tests observe the public renderer output and UI controls: structural summaries, local search entry/display, and subtree-only filtering.
