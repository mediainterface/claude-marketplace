# Claude Marketplace

Internal Claude Code plugin marketplace for MediaInterface.

## Usage

Add the marketplace:

```
/plugin marketplace add mediainterface/claude-marketplace
```

Install a plugin:

```
claude plugin install <plugin-name>@mediainterface
```

## Adding a Plugin

1. Create a directory under `plugins/<your-plugin-name>/`.
2. Add a `.claude-plugin/plugin.json` manifest inside it.
3. Register the plugin in `.claude-plugin/marketplace.json` under the `plugins` array.
4. Open a PR.
