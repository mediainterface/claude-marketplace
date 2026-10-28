---
name: mira-product-doc
description: >-
  Writes or reworks a page of a product documentation tree (docs/product/ of an app or service)
  in the house form of the MIRA manuals: American English, every UI label and message quoted
  word for word from the English interface, facts taken from today's code, and a page that takes
  its reader once through the feature and back to the state they started in, without ever
  saying so. Use when a story asks to document a feature ("dokumentieren", "Doku schreiben",
  "Handbuchseite"), when a page under docs/product/ is written, updated after a feature change,
  aligned with the model pages or reviewed. Not for READMEs, CLAUDE.md files, specs or decision
  records.
argument-hint: <work item ID, feature, or page path>
---

# Product doc

A product page is read by someone in the middle of a task, with the app open beside it. It says
what the reader does and what the app shows in response, in the interface's own words, and it
takes them once through the feature so that they end where they began. Everything below serves
that reader.

## Workflow

1. **Read the house rules first.** In the repository: `.claude/rules/product-documentation.md`
   (front matter, page form, links), the tree's own `CLAUDE.md` (folders, audiences, the closing
   line's ladder) and the model pages `apps/mira-desktop/docs/product/features/dictating-a-text.md`
   and `apps/mira-desktop/docs/product/getting-started/authentication.md`. Where the repository's
   rules and this skill differ, the repository wins. Without such rules, use the form below.
2. **Read the work item** through `ado-toolkit:ado-workitem` when it is installed: description,
   acceptance criteria, parent epic and comments. Comments and the epic often carry facts meant
   for the documentation, such as a limit or a remote-session case.
3. **Take the facts from the code on `main`**, never from specs, epics or memory: the English
   translation file for every label and message, the components for order and conditions, the
   backend for rules (roles, limits, times, emails sent), mail templates for email subjects.
   Where code and spec disagree, the code wins; name each disagreement to the user. For a large
   feature, brief a read-only subagent for a fact sheet with a source per fact and the exact
   English strings.
4. **Look at open pull requests and branches on the same tree.** A page in flight is neither
   duplicated nor contradicted. Link to it only when the user agrees, and say in the pull request
   that it merges after that one.
5. **Settle the open decisions with the user, one at a time:** audience and folder, how many
   pages, what stays out, and every fact neither code nor spec answers (a vendor's consent step,
   a product name). Never fill such a gap with a plausible guess.
6. **Write the page**, then **check it** (below) and repeat the check until a pass finds nothing.

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
  trip", "full circle", "once around", "back where you started", "ready for the next round", "close
  the loop", no `## Starting point` section, no closing step "Back to the start". The intro says
  what the feature does for the reader, not what the guide will walk through. The reader notices
  the circle from the order of the sections alone.

## Voice

- **American English:** *recognize*, *organization*, *color*, *gray*, *center*, *behavior*,
  *canceled*, *license* (noun and verb), *email* (not *e-mail*), *toward*.
- **Second person, present tense, active.** Pair each action with what the reader then sees: the
  button that changes its text, the message that appears, the window that opens.
- **No em dashes in prose.** Use a comma, a colon, a semicolon or a new sentence. A dash inside a
  quoted interface text stays as the interface has it.
- **Exact interface words.** Labels in bold, messages in italics, exactly as the English
  interface (or the email, or the vendor's page) words them. Roles as the interface names them.
- **Plain facts only.** No marketing, no history (*new*, *now*, *no longer*, *since version*), no
  implementation detail (endpoints, tokens, claims, job names). A time the reader notices is a
  fact ("within 15 minutes"); the mechanism behind it is not.
- **Today's behavior.** Nothing planned. A feature in an open pull request is written only when
  the user confirms it merges first.
- **One app per page.** Another app appears in one sentence at a time, as the place where
  something happens.
- **Edge cases the audience meets, no others.** An administrator's page names a shared domain; a
  user's page does not.

## Form

The repository's rule is binding. Its shape, for a repository without one:

- Front matter (`title`, `description`, `audience`, `category`, `status`, `tags`, `order`); the
  first `#` heading equals the title.
- An intro of one to three sentences on what the feature does for the reader.
- `## Before you start`: one sentence on where the reader is, then "You also need:" and a list
  whose items are a bold lead and one or two sentences.
- One `##` section per task, named as an instruction (`## Sign in`, `## Switch SSO off`), with
  numbered steps of one action each; a single-task page uses `## Step by step`. Short extras go
  into `## More options` as bold-lead bullets. A hint goes into a `> **Tip:**` block.
- `## If it doesn't work`: a table *What you see* | *What it means* | *What to do*, with the
  messages a reader actually meets, then the closing line from the tree's ladder.
- The folder's `README.md` lists the page; `order` places it.
- Prose hard-wrapped at 100 characters; tables, front matter and long URLs stay unwrapped.

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
- **Links:** only within the page's own folder (or the one exception the repository's rule
  allows), every target exists or sits in a pull request the user confirmed merges first, no link
  into source files or decision records, no link to a renamed section anchor left behind.
- **Wrap:** no prose line longer than 100 characters.

## Reworking an existing page

The facts stay, the form changes. Move the starting state into `## Before you start`, drop every
named circle and every `## Starting point` section, rename sections to instructions (`If sign-in
doesn't work` becomes `If it doesn't work`), replace em dashes and British spellings, verify
every label against today's code and delete rows whose message is gone. Rewrap only the
paragraphs you change; a reflowed page hides its real edits. Then run the full check.
