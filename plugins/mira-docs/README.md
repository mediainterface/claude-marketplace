# mira-docs

The tools for MIRA's documentation.

| Skill | What it does |
|---|---|
| `/mira-product-doc` | Writes a new page of MIRA's product documentation (user manual or internal page) or brings an existing one up to date. It reads the work item and the code, follows the rules of MIRA's manuals and checks the page before handing it over. |

## Prerequisites

- **The MIRA repository**, where each app keeps its product documentation in `docs/product/`.
- **Optional: `ado-toolkit`**, to read the work item, its epic and comments. Without it, name
  the feature or the page instead.

## Install

```
claude plugin install mira-docs@mediainterface
```

## Use

```
/mira-product-doc <work item ID>
/mira-product-doc <page to rework>
/mira-product-doc <feature to document>
```
