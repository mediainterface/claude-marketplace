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
 * The SDD workflow is MediaInterface-internal, so the policy is injected only
 * when the session's project has an `origin` remote pointing at the MI
 * collection on ado.mediainterface.de (https, ssh:// or scp-like form). In any
 * other repo the hook emits nothing; the sdd-kit skills remain manually
 * invokable there, which is the explicit opt-in.
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

if (!originIsMiCollection(cwd)) {
  process.exit(0); // not an MI repo -> the SDD policy does not apply
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
      additionalContext: policy,
    },
  })
);

process.exit(0);

function originIsMiCollection(dir) {
  let url;
  try {
    url = execSync("git remote get-url origin", {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch (_) {
    return false; // no git repo or no origin remote
  }
  return matchesMiCollection(url);
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
