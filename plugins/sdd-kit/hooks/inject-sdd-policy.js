#!/usr/bin/env node
/*
 * SessionStart hook for sdd-kit.
 *
 * Injects a project-level SDD policy that OVERRIDES the superpowers brainstorming
 * skill's writing-plans handoff: once a spec is written and approved, route to
 * /spec-pr (open a PR for the spec and stop) instead of writing an implementation
 * plan or code.
 *
 * Delivered as SessionStart `additionalContext` — the same channel superpowers uses
 * for its own primer — with matcher startup|clear|compact so the policy re-injects
 * after compaction and stays present through a long brainstorming session.
 *
 * Node so it runs everywhere Claude Code runs, including Windows, with no extra
 * tooling.
 */
"use strict";

const POLICY =
  "PROJECT SDD POLICY — this project-level instruction OVERRIDES the superpowers " +
  "brainstorming skill's writing-plans handoff. In this Spec-Driven-Development " +
  "workflow, once the brainstorming skill has produced a design spec and the user " +
  "has approved it, do NOT invoke the writing-plans skill and do NOT write an " +
  "implementation plan or any code. Instead, invoke the sdd-kit:spec-pr skill, " +
  "which opens a pull request for the spec (plus any Memory Bank items) and then " +
  "stops until the PR is merged. The implementation plan (writing-plans) comes " +
  "only AFTER the spec PR is merged, as a separate later effort. Proceed to " +
  "writing-plans now ONLY if the user explicitly asks for an implementation plan " +
  "in this session.";

// SessionStart passes a small JSON payload on stdin; we don't need it, but consume
// it so nothing blocks on the pipe.
try {
  require("fs").readFileSync(0, "utf8");
} catch (_) {
  /* no stdin — fine */
}

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: POLICY,
    },
  })
);

process.exit(0);
