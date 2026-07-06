#!/usr/bin/env node
/*
 * PostToolUse (Write) hook for sdd-kit.
 *
 * When the superpowers brainstorming skill writes a Spec-Driven-Development spec
 * (docs/superpowers/specs/<...>-design.md), inject a project-level policy that
 * OVERRIDES the brainstorming -> writing-plans handoff and routes to /spec-pr:
 * open a PR for the spec and stop, instead of writing an implementation plan.
 *
 * Reads the PostToolUse JSON payload on stdin and matches the Write tool's
 * file_path field (handling both / and \ separators). Filtering happens HERE
 * rather than via an `if` glob, so behaviour does not depend on hook-matcher glob
 * semantics. Emits nothing for any other write.
 */
"use strict";

const POLICY =
  "PROJECT SDD POLICY — this project-level instruction OVERRIDES the superpowers " +
  "brainstorming skill's writing-plans handoff. A Spec-Driven-Development design " +
  "spec was just written to this repository. When this spec is approved by the " +
  "user, do NOT invoke the writing-plans skill and do NOT write an implementation " +
  "plan or any code. Instead, invoke the sdd-kit:spec-pr skill, which opens a pull " +
  "request for the spec (plus any Memory Bank items) and then stops until the PR is " +
  "merged. Invoke writing-plans ONLY if the user explicitly asks for an " +
  "implementation plan in this session.";

// docs/superpowers/specs/<anything>-design.md, with / or \ path separators.
const SPEC_PATH = /[\\/]docs[\\/]superpowers[\\/]specs[\\/][^\\/]*-design\.md$/;

let raw = "";
try {
  raw = require("fs").readFileSync(0, "utf8");
} catch (_) {
  process.exit(0); // no stdin -> nothing to do
}

let filePath = "";
try {
  const payload = JSON.parse(raw);
  filePath = (payload && payload.tool_input && payload.tool_input.file_path) || "";
} catch (_) {
  process.exit(0); // unparseable payload -> do nothing, never block the write
}

if (SPEC_PATH.test(filePath)) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: POLICY,
      },
    })
  );
}

process.exit(0);
