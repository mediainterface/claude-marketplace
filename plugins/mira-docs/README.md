# mira-docs

The tools for MIRA's documentation.

| Skill | What it does |
|---|---|
| `/mira-product-doc` | Writes a new page of the product documentation (user manual or internal page) or brings an existing one up to date. It reads the work item and the code, follows the repository's documentation rules and checks the page before handing it over. |

The repository's own rules come first: in MIRA, `.claude/rules/product-documentation.md` and the
tree's `CLAUDE.md`. The skill adds how a page is researched, written and checked.

## Prerequisites

- **A repository with a product documentation tree** (`docs/product/` of an app or service).
- **Optional: `ado-toolkit`**, to read the work item, its epic and comments. Without it, name
  the feature or the page instead.

## Install

```
claude plugin install mira-docs@mediainterface
```

## Use

```
/mira-product-doc 1208
/mira-product-doc services/portal-app/docs/product/features/setting-up-single-sign-on.md
```
