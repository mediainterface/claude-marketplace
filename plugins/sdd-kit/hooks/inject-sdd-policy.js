#!/usr/bin/env node
/*
 * SessionStart hook for sdd-kit.
 *
 * Injects the project SDD policy (hooks/sdd-policy.md) as SessionStart
 * `additionalContext` — the same channel superpowers uses for its own primer — so
 * it overrides the brainstorming skill's writing-plans handoff and routes to
 * /spec-pr. The hook's matcher (startup|clear|compact) re-injects it after
 * compaction, keeping it present through a long session.
 *
 * The SDD workflow is MediaInterface-internal, so the policy is always injected
 * together with an applicability preamble derived from the project's `origin`
 * remote: in the MI collection on ado.mediainterface.de (https, ssh:// or
 * scp-like form) the policy is in force; with any other origin Claude is primed
 * but must ask the user before following it; without a git repo or origin it is
 * reference-only and Claude does not ask at all.
 *
 * The policy prose lives in sdd-policy.md so it can grow without touching this
 * script; JSON.stringify handles escaping the Markdown. Node so it runs everywhere
 * Claude Code runs, including Windows.
 */
"use strict";

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ADO_HOST = "ado.mediainterface.de";
const ADO_COLLECTION = "mi";

const PREAMBLES = {
  mi:
    "# SDD policy applicability\n\n" +
    "This session's project has its git origin in the MI collection on " +
    "ado.mediainterface.de: the SDD policy below is in force.",
  other:
    "# SDD policy applicability\n\n" +
    "This session's project has a git origin outside the MI collection on " +
    "ado.mediainterface.de, so the SDD policy below is NOT automatically in " +
    "force (its wording assumes an MI project). It is included so you know the " +
    "workflow: before acting on any part of it — e.g. when a spec has been " +
    "approved and you would route to /spec-pr instead of writing-plans, or when " +
    "ADO tasks would be created — ask the user once whether this project should " +
    "follow the SDD workflow, and follow it only on an explicit yes.",
  none:
    "# SDD policy applicability\n\n" +
    "This session's project has no git origin (or is not a git repository), so " +
    "the SDD policy below is NOT in force. It is included only for reference — " +
    "do not ask the user about it; follow it only if the user explicitly asks " +
    "for the SDD workflow.",
};

// The SessionStart payload's `cwd` is the project directory the session runs in.
let cwd = process.cwd();
try {
  const payload = JSON.parse(fs.readFileSync(0, "utf8"));
  if (payload && typeof payload.cwd === "string" && payload.cwd) {
    cwd = payload.cwd;
  }
} catch (_) {
  /* no or malformed stdin — fall back to process.cwd() */
}

let policy;
try {
  policy = fs.readFileSync(path.join(__dirname, "sdd-policy.md"), "utf8").trim();
} catch (_) {
  process.exit(0); // policy file missing -> inject nothing rather than error out
}

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: PREAMBLES[originStatus(cwd)] + "\n\n" + policy,
    },
  })
);

process.exit(0);

// 'mi' when origin is the MI collection, 'other' for any other origin,
// 'none' when there is no git repo or no origin remote.
function originStatus(dir) {
  let url;
  try {
    url = execSync("git remote get-url origin", {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch (_) {
    return "none";
  }
  if (!url) return "none";
  return matchesMiCollection(url) ? "mi" : "other";
}

// True when the host is ado.mediainterface.de and the first path segment is
// exactly the MI collection (case-insensitive, any user/port). Segment-exact so
// a collection like /MIRA never matches. Handles https://, ssh:// and the
// scp-like git@host:path form.
function matchesMiCollection(url) {
  let host, pathname;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      host = parsed.hostname;
      pathname = parsed.pathname;
    } catch (_) {
      return false;
    }
  } else {
    const scpLike = /^(?:[^@/\s]+@)?([^:/\s]+):(.*)$/.exec(url);
    if (!scpLike) return false;
    host = scpLike[1];
    pathname = scpLike[2];
  }
  if (host.toLowerCase() !== ADO_HOST) return false;
  const firstSegment = pathname.split("/").filter(Boolean)[0] || "";
  return firstSegment.toLowerCase() === ADO_COLLECTION;
}
