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
 * The policy prose lives in sdd-policy.md so it can grow without touching this
 * script; JSON.stringify handles escaping the Markdown. Node so it runs everywhere
 * Claude Code runs, including Windows.
 */
"use strict";

const fs = require("fs");
const path = require("path");

// Consume the SessionStart payload on stdin so nothing blocks on the pipe.
try {
  fs.readFileSync(0, "utf8");
} catch (_) {
  /* no stdin — fine */
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
