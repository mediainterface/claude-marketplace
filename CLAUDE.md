# Claude Marketplace

Internal Claude Code plugin marketplace for MediaInterface.

## Plugin Conventions

- All plugins go under `plugins/<plugin-name>/`.
- Each plugin must have `.claude-plugin/plugin.json` at minimum.
- Plugin directories use kebab-case naming (e.g., `my-cool-plugin`).
- When adding a new plugin, register it in `.claude-plugin/marketplace.json` in the `plugins` array.
- No external dependencies at the marketplace level — only individual plugins may have their own.

## Plugin Entry Format

When registering a plugin in `marketplace.json`, add an entry like:

```json
{
  "name": "my-plugin",
  "source": "./my-plugin",
  "description": "What the plugin does",
  "version": "1.0.0"
}
```

The `source` path is relative to `pluginRoot` (`./plugins`).
