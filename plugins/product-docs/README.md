# product-docs

Product documentation for Claude Code, in the house form of the MIRA manuals.

| Skill | What it does |
|---|---|
| `/product-doc` | Write a new page under `docs/product/` or bring an existing one into the house form: facts from today's code, every label and message quoted from the English interface, American English, a page that takes the reader once through the feature and back to where they started, and a check that runs until it finds nothing. |

The repository's own rules come first: in MIRA, `.claude/rules/product-documentation.md` and the
tree's `CLAUDE.md`. The skill adds how a page is researched, written and checked.

## Prerequisites

- **A repository with a product documentation tree** (`docs/product/` of an app or service).
- **Optional: `ado-toolkit`**, to read the work item, its epic and comments. Without it, name
  the feature or the page instead.

## Install

```
claude plugin install product-docs@mediainterface
```

## Use

```
/product-doc 1208
/product-doc services/portal-app/docs/product/features/setting-up-single-sign-on.md
```
