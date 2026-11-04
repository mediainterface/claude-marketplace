---
name: pr-screenshots
description: >-
  Tests a UI change by hand in the real, running app and puts screenshots of it into the
  description of its Azure DevOps pull request. Use when a pull request whose change alters what
  users see — a screen, dialog, layout, style, icon or UI text — is about to be created, when the
  user asks for screenshots in a PR, or when review fixes changed a state a PR already pictures.
  Runs once, when the UI is final — never per plan task or for interim states. Web and Electron
  apps are driven with Playwright; for WPF and every other UI that Playwright cannot drive, it
  tells the user to add the screenshots by hand. Not for spec PRs, nor for changes nobody sees in
  the UI.
argument-hint: "[PR ID — optional; without one, the PR about to be created from this branch]"
---

# Screenshots of UI changes in the PR description

Reviewers see a UI change in the PR without checking the branch out, and the round that takes the
screenshots is the author's own manual test of the change. This skill runs that round: it starts
the real app, walks through the change, captures the changed states and puts them into the PR
description.

## When: once, when the UI is final

Take the screenshots in **one round**, at the point the UI of the PR is final: the implementation
is complete, it has been compared with the design artifact (if the spec links one), and the fixes
from your own review are in. That is right before the PR is created.

- **Never earlier.** Not per plan task, not after each subagent, not for interim states, not before
  the design comparison. Each round tests the whole change through the running app with Playwright
  and captures it, which costs many tokens and much time — and every round on a UI that still
  changes is spent for nothing.
- **An implementation plan** with UI tasks gets one closing step for this round, before the PR —
  no screenshot step in the individual tasks.
- **Review changes a pictured state later:** retake only the affected states, against the app that
  is still running (Step 4, *Retake*).
- **Spec PRs never get screenshots** — there is no UI yet; the spec links the design artifact
  instead.

## Step 1: Is there a visible change, and can Playwright drive it?

Decide from the branch's changed files (`git diff --name-only origin/<target>...HEAD`):

| The change | What happens |
|---|---|
| Changes nothing users see — tests, docs, server-side logic, a refactoring without visible effect | The skill ends here, without a word |
| A web app — a JS/TS UI rendered in the browser (React, Vue, Angular, Svelte, Vite …) | Supported: Playwright in a browser |
| An Electron app | Supported: Playwright against the real Electron app |
| WPF (`*.xaml`, a `.csproj` with `<UseWPF>true</UseWPF>`), WinForms, MAUI, native mobile, anything else not rendered by a browser engine | **Not supported** — tell the user (below) |

**Not supported:** Playwright drives browser engines only, and for WPF nothing comparably reliable
exists yet. Tell the user once — when the PR is about to be created, or right away when they asked
for screenshots — that this project is not supported by the screenshot flow and that the
screenshots for the PR description have to be taken by hand, into a section **So sieht es aus**
after **Inhalt** (Step 4). Then carry on with the PR. Do not capture the app any other way (screen
capture, desktop automation). A PR that touches a supported and an unsupported UI gets the round
for the supported part and the note for the other.

## Step 2: Start the real app — once, and keep it running

Screenshots show the **real, running app in its full window**, as a user sees it. Never a single
component in a harness page with stubbed data or APIs: such a cut-out looks unfinished and proves
nothing about the real app.

- **Start it the way the repo documents it** — its `CLAUDE.md` files, READMEs and
  `.claude/rules/`, an existing Playwright config (`webServer`), launch configurations, a project
  skill for running the app. Whatever else the app needs in order to run is found there as well.
  If the repo documents nothing, ask the user how they run it; never assume a setup.
- **Fresh worktree:** install the app's dependencies there first. Never link or copy
  `node_modules` from the main checkout — the branch may need packages the main checkout lacks.
- **Something seems missing** (a secret, a tool, access): prove it with a one-liner before
  concluding it is (`which`, `--version`, a check that prints nothing). Never print secrets or a
  process's environment. If the app cannot be started, tell the user what is missing and wait — a
  stub harness is no substitute. If it cannot be fixed, fall back to the note from Step 1.
- **States the data lacks** (a role, a setting, long values): produce them the way the app allows
  — through its own UI, or in the data the local app runs against. Only a state that cannot be
  produced locally at all — a service unreachable, a specific failure — may be simulated by
  intercepting that one request in the real app (`page.route`); the section's intro line then
  says so.
- **Keep running what you started** until the PR's review fixes are through, and tell the user what
  it is: a retake then captures only the affected state, without starting over. Parallel agents
  never share ports or data.
- **Electron:** launch the real app with Playwright's `_electron.launch` (from the repo's own
  Playwright dependency, otherwise `playwright` installed into a temp folder), or start it with
  `--remote-debugging-port=<port>` and attach with `chromium.connectOverCDP`. Give it its own
  `--user-data-dir`, so an instance the user runs, and its single-instance lock, stay untouched.
  Stop only the processes you started — never kill by the app's name.

## Step 3: Test by hand, then capture

Browser apps: use the Playwright MCP (`browser_navigate`, `browser_snapshot`, `browser_click`,
`browser_take_screenshot`), not a built-in browser pane, which scales the window down. Without the
MCP, and for Electron, a short Playwright script does the same.

**Test the change as a user would:**

- Walk through what the change does — the work item's acceptance criteria and, if there is a spec,
  its test cases — including the error, empty and permission variants the change touches. Watch
  the console for errors (`browser_console_messages`).
- Navigate and check with `browser_snapshot` (text, cheap); take image screenshots only of the
  states that go into the PR.
- A defect, or a deviation from the design artifact, means the UI is not final: fix it first, then
  capture.
- This is the author's check before the review. It does not replace the team's own testing, and a
  state that cannot be reached locally does not block the PR — name it to the user.

**Capture:**

- Window 1440×900 (`browser_resize`) unless the app targets another size, the full window, the UI
  language its users see, the default theme unless the change is about theming.
- One image per visibly new or changed state — a new screen or dialog and its error, empty,
  read-only or permission variants. Usually two to six; not every click.
- A state that just changed (a button just disabled, a transition) must settle first: a background
  tab starts CSS transitions only when it renders, so query the element's `getComputedStyle` a few
  times via `browser_evaluate` before capturing.
- Look at each image once: the right state, nothing cut off, in line with the design.
- Name the files `<nn>-<state>.png` (`01-dialog.png`, `02-error.png`) and keep them outside the
  repository, in a temp folder of the session. The Playwright MCP writes into `.playwright-mcp/`
  in the working directory: move the images out, delete the folder, and check that `git status`
  shows nothing new.

## Step 4: Into the PR description

Images are attached to the PR itself, so the PR has to exist before they can be uploaded. The
user still reviews text and images once, before the PR is created.

1. **One review for text and images.** When `ado-toolkit:ado-pr`'s **PR Creation** shows the
   draft to the user (its step 8), show the screenshots with it and the section below as it will
   stand in the description, with the file names in place of the image links. That approval
   covers the upload and the section. Create the PR as that workflow says, without the section:
   its links exist only after the upload.
2. **Upload each image** as a PR attachment. `az` cannot send a binary body, so this one call goes
   through `curl` with integrated Windows/Kerberos authentication (`--negotiate -u :`);
   `{organization}`, `{project}` and `{repository}` are what `ado-toolkit`'s Step 0 detected:

   ```bash
   curl -s --negotiate -u : -X POST -H "Content-Type: application/octet-stream" \
     --data-binary @"<folder>/<file>.png" \
     "{organization}/{project}/_apis/git/repositories/{repository}/pullRequests/{prId}/attachments/<file>.png?api-version=7.1"
   ```

   The response's `url` is the image link — use it exactly as returned. A `401` means integrated
   authentication is not available on this machine: tell the user, and never fall back to a token
   from the environment. The images then go to the user to add by hand.
3. **Insert the approved section** with `ado-toolkit:ado-pr`'s **PR Update** — after **Inhalt**
   (or the repo template's summary), before **Betroffene Komponenten**. Only the links are new
   since the user's approval in step 1, so do not ask again. German and not wrapped, like all
   text sent to Azure DevOps:

   ```
   **So sieht es aus**
   <only if needed, one line, e.g. „Serverantwort für den Fehlerfall nachgestellt.“>

   - <Zustand>:
   ![<Zustand>](<url>)
   ```

   Azure DevOps caps a PR description at 4000 characters, and each image with its line takes about
   200. If it does not fit, tighten the text — the images never move into a comment.
4. **Verify:** read the description back and count the image links.

**Retake** after review fixes changed a pictured state: capture only that state, upload it under a
new name (`02-error-2.png`), swap the link in the description and delete the superseded attachment
(`curl -s --negotiate -u : -X DELETE "<its url>?api-version=7.1"`).

**Not Azure DevOps** (e.g. GitHub): there is no upload here — hand the images to the user to drop
into the PR description.

## As a lead with subagents

Delegate the whole round — app, manual test, capture, upload — to **one** agent: screenshots and
logs in the lead's context eat it up. The brief names the worktree, the PR ID once it exists, the
ports and data the agent may use, what to test, the design files (fetch them for the agent
beforehand — subagents may lack the tools that open design artifacts), the user's approval to
upload and to edit the description, and the stop cases: the app does not start, a defect turns up,
authentication fails. The agent saves the images in a session folder and reports their paths; the
lead passes them on to the user without opening them.

## Done when

- The PR description shows every visibly changed state in a **So sieht es aus** section, taken
  from the real app in its full window — or the user knows that this project's screenshots are
  theirs to add.
- The manual test ran, and the user knows what could not be tested locally.
- No screenshot, `.playwright-mcp/` folder or temporary config change is left in the repository.
- What you started still runs for retakes, and the user knows what it is.
