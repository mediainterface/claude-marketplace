---
name: mira-product-doc
description: >-
  Writes or reworks a page of MIRA's product documentation, the docs/product/ trees of MIRA
  Desktop and the portal (PortalApp), user manual and internal pages alike, and holds every rule
  for them: folders, front matter, audiences, the page form, links, voice and the closing line
  of each tree. Use when a work item asks to document a MIRA feature or to write a manual page,
  when a page under docs/product/ is written, updated after a feature change, aligned or
  reviewed, and when a new docs/product/ tree is set up. Not for READMEs outside docs/product/,
  CLAUDE.md files, specs or decision records.
argument-hint: <work item ID, feature, or page path>
---

# MIRA product documentation

MIRA's product documentation is English Markdown in one tree per app, the app's `docs/product/`
folder: one for MIRA Desktop and one for the portal, *MIRA® medical Portal* in its interface. A
hosting tool publishes it: it takes the folder tree over as the navigation and reads each page's
front matter for the table of contents, the release gate and the audience filter.

A page is read by someone in the middle of a task, with the app open beside it. It says what the
reader does and what the app shows in response, in the interface's own words, and it takes them
once through the feature so that they end where they began.

Everything in this skill is an instruction, not content: never copy it into a page, the
`README.md` section intros included.

## Workflow

1. **Read the work item** through `ado-toolkit:ado-workitem` when it is installed: description,
   acceptance criteria, parent epic and comments. Comments and the epic often carry facts meant
   for the documentation, such as a limit or a remote-session case.
2. **Take the facts from the code on `main`**, never from specs, epics or memory: the app's
   English translation file for every label and message, the components for order and
   conditions, the backend for rules (roles, limits, times, emails sent), the server's resource
   files for its messages and the mail templates for email subjects. Where code and spec
   disagree, the code wins; name each disagreement to the user. For a large feature, brief a
   read-only subagent for a fact sheet with a source per fact and the exact English strings.
3. **Look at open pull requests and branches on the same tree.** A page in flight is neither
   duplicated nor contradicted. Link to it only when the user agrees, and say in the pull request
   that it merges after that one.
4. **Settle the open decisions with the user, one at a time:** audience and folder, how many
   pages, what stays out, and every fact neither code nor spec answers (a vendor's consent step,
   a product name). Never fill such a gap with a plausible guess.
5. **Write the page**, then **check it** (below) and repeat the check until a pass finds nothing.

## Folders and files

The folder tree is the navigation, so folder and file names must read well as menu entries.

| Folder | MIRA Desktop | Portal |
|--------|--------------|--------|
| `getting-started/` | First-run and orientation topics for end users | First steps in the portal for end users: signing in, password, downloads |
| `features/` | End-user guides, one topic per feature | End-user guides, one topic per feature |
| `internal/` | Documentation for MediaInterface staff | Documentation for MediaInterface staff |

- Add a `technical/` folder only for a genuinely technical document (`audience: technical`).
- Folder and file names are lowercase `kebab-case`; files end in `.md`.
- One topic per file, and the file name is the topic (`authentication.md`), not a document type.
- The first `#` heading matches the front-matter `title`.
- The tree's root and every folder have a `README.md` with `order: 1`. A folder's README lists
  its pages, one bullet each: `- [Title](file.md): what the reader does there.`

## Front matter

Every page starts with a front-matter block of these fields; [example-page.md](example-page.md)
shows one.

| Field | Required | Values | Meaning |
|-------|----------|--------|---------|
| `title` | yes | free text | Navigation title and first heading |
| `description` | yes | free text | One-line summary for listings and search |
| `audience` | yes | `external`, `internal`, `technical` | Who the page is for (below) |
| `category` | when relevant | `manual`, `marketing` | Publication track; omit for internal and technical notes |
| `status` | yes | `draft`, `review`, `released` | Release gate; only `released` is published externally |
| `tags` | yes | list | Filter keywords (`manual`, `marketing`, `internal`, `external`, topic tags) |
| `order` | yes | integer | Position within the folder, ascending |

`audience` names three readerships, not a severity scale:

- `external`: end users and customers (the user manual).
- `internal`: MediaInterface staff. Explains what to do and what something means, without
  implementation detail.
- `technical`: developers. Explains how it works internally; keep this out of `internal` pages.

A folder's `README.md` takes `order: 1`; its pages start at `2`. To insert a page between two
others, renumber the pages after it. Two branches that add pages to the same folder collide on
`order`: whoever merges last renumbers.

## Audiences and closing line, per tree

The closing line follows the `## If it doesn't work` table and names whom the reader turns to
next. It names the next level up, not always "your administrator": an administrator has no
administrator to ask, and a lower administrator asks the upper one before support.

**MIRA Desktop.** Every end-user page describes what a user does in MIRA Desktop; administration
happens in the portal. A reader with an administrator role reads a page as a user, so the closing
line is always: "If a problem persists after these steps, contact your administrator."

**Portal.** The portal is role-gated, so the role that reaches a feature decides the audience:

- **Customer roles → `external`:** a user without an administrator role, Tenant Administrator and
  Subscription Administrator. A feature that a customer role and a staff role both reach is
  `external` too; its page names only the customer role.
- **Staff roles → `internal`, in `internal/`:** Cloud Administrator, Cloud Manager, Cloud Support
  and Cloud Tester, for features only they reach.
- `ResourceManager`, `Synchronizer` and `System` gate no portal surface and get no pages of their
  own. The interface has no name for them; a page that lists roles may still name them.
- An `external` page names the role it needs under `## Before you start` and never names a staff
  role. Roles are named exactly as above, as the English interface shows them.

| Reader | Closing line |
|--------|--------------|
| User without an administrator role | "If a problem persists after these steps, contact your administrator." |
| Tenant administrator | "If a problem persists after these steps, contact your subscription administrator." |
| Subscription administrator | "If a problem persists after these steps, contact MediaInterface support." |

A page that several of these readers follow names the next level for each of them in one
sentence.

## The circle

- Every page takes its reader once through the feature and leaves them in the state they started
  from: an empty editor, dictated, handed off, empty again; signed out, signed in, signed out
  again; a tenant without single sign-on, connected, switched on, switched off again.
- Find the starting state first and write it into `## Before you start`, as the sentence that
  says where the reader is. Order the task sections so that the last task returns there and says
  what changes on the way back. Tasks outside the cycle go into `## More options` or after it.
- A feature without a way back (a deletion) closes on the state the reader started from in the
  app, such as the list without the item.
- **The circle is a content requirement, never a narrative device.** Do not name it: no "round
  trip", "full circle", "once around", "back where you started", "ready for the next round",
  "close the loop", no `## Starting point` section, no closing step "Back to the start". The intro
  says what the feature does for the reader, not what the guide will walk through. The reader
  notices the circle from the order of the sections alone.

## Page form

Every `external` page, in every tree:

- An intro of one to three sentences on what the feature does for the reader, then straight into
  the content.
- `## Before you start`: one sentence on where the reader is in the app, then "You also need:"
  and the prerequisites as a list, each item a bold lead followed by one or two sentences.
- One `##` section per task, named as an instruction (`## Sign in`, `## Switch SSO off`), with
  short numbered steps of one action each. A page with a single task uses `## Step by step`;
  short extras go into `## More options` as bold-lead bullets. A hint goes into a `> **Tip:**`
  block.
- `## If it doesn't work`: a table with the columns *What you see*, *What it means* and *What to
  do*, listing the messages a reader actually meets, then the tree's closing line.

[example-page.md](example-page.md) shows a complete page in this form.

`internal` and `technical` pages keep the front matter, the voice, the circle and the links;
their sections follow their topic.

## Voice

- **American English:** *recognize*, *organization*, *color*, *gray*, *center*, *behavior*,
  *canceled*, *license* (noun and verb), *email* (not *e-mail*), *toward*.
- **Second person, present tense, active.** Pair each action with what the reader then sees: the
  button that changes its text, the message that appears, the window that opens.
- **No em dashes in prose.** Use a comma, a colon, a semicolon or a new sentence. A dash inside a
  quoted interface text stays as the interface has it.
- **Exact interface words.** Labels in bold, messages in italics, exactly as the English
  interface (or the email, or the vendor's page) words them.
- **Plain facts only.** No marketing, no history (*new*, *now*, *no longer*, *since version*), no
  implementation or build detail (endpoints, tokens, claims, job names); that belongs in the
  developer documentation. A time the reader notices is a fact
  ("within 15 minutes"); the mechanism behind it is not.
- **Today's behavior.** Nothing planned. A feature in an open pull request is written only when
  the user confirms it merges first.
- **One app per page.** Another app appears in one sentence at a time, as the place where
  something happens.
- **Edge cases the audience meets, no others.** An administrator's page names a shared domain; a
  user's page does not.
- **Wrap prose at 100 characters.** Tables, front matter and long URLs stay unwrapped.

## Links

Links never cross an audience boundary or leave the documentation tree:

- A page links only to pages in its own folder.
- One exception: an `internal` page may link to the matching `external` page in a neighboring
  folder, never the reverse.
- An `external` page never links to an `internal` or `technical` page.
- Never link outside the documentation tree: no source files, no decision records. If a fact or
  reason matters to the reader, write it into the page.

## Check

Run every check, fix what it finds, and run them all again until a pass finds nothing.

- **Interface words:** extract every `**…**` and `*…*` (join wrapped lines first) and search each
  in the English translation file, the server's resource files and mail templates. Bold leads,
  section names and a vendor's labels are the expected misses; everything else is a finding.
- **Stale rows:** every message in the table still exists in the code. A removed message is
  deleted from the table, not kept "for older versions".
- **Circle wording:** search for `round trip`, `full circle`, `once around`, `back where`,
  `where you started`, `where you began`, `ready for the next`, `close the loop`,
  `starting point`, `back to the start`. Each hit is rewritten, not softened.
- **Spelling and dashes:** search for `—` in prose and for `colour`, `grey`, `organis`,
  `recognis`, `behaviour`, `centre`, `cancelled`, `licence`, `e-mail`.
- **Circle content:** the last task section returns to the state named in `## Before you start`.
- **Form:** front matter complete, title equals the first heading, sections as above, the
  closing line of the tree and the reader, the page listed in its folder's `README.md`.
- **Links:** as above, every target exists or sits in a pull request the user confirmed merges
  first, no link to a renamed section anchor left behind.
- **Wrap:** no prose line longer than 100 characters.

## Reworking an existing page

The facts stay, the form changes. Move the starting state into `## Before you start`, drop every
named circle and every `## Starting point` section, rename sections to instructions (`If sign-in
doesn't work` becomes `If it doesn't work`), replace em dashes and British spellings, verify
every label against today's code and delete rows whose message is gone. Rewrap only the
paragraphs you change; a reflowed page hides its real edits. Then run the full check.

## A new tree

A new app or service gets `docs/product/` with a root `README.md` (`audience: internal`,
`order: 1`) and the folders above, each with its `README.md`. Its folders, its audiences and its
closing line are added to this skill first, in the marketplace, so every tree keeps reading from
one set of rules.
