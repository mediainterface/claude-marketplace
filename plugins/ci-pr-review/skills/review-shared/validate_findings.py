#!/usr/bin/env python3
"""Validate a review skill's findings.json before the pipeline posts it.

Usage: validate_findings.py <path/to/findings.json>

Run from inside the repository checkout. Checks, in this order:
- the file against findings.schema.json next to this script, the contract the poster
  validates against as well;
- the review log against the checks the skill declares in ../<skill>/review.json;
- every anchor against the reviewed diff: a file the PR changes, lines that exist at the
  reviewed commit, so that Azure DevOps can attach the comment;
- pullRequestId and reviewedCommit against the pr.json next to findings.json, if present.

Exits 0 when there are no errors (warnings allowed), 1 otherwise. Standard library only: the
build agent may have nothing else installed.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

REVIEW_DIR = Path(__file__).resolve().parent
SCHEMA_PATH = REVIEW_DIR / "findings.schema.json"
SKILLS_DIR = REVIEW_DIR.parent
# Comments past this length rarely stay short enough to be read in a PR thread.
LONG_COMMENT_CHARS = 1200
# How far an anchor may sit from a changed line before it is reported as outside the change.
HUNK_SLACK_LINES = 3

# The JSON Schema subset findings.schema.json uses. An unknown keyword fails loudly, so a schema
# change can never pass here unchecked and then fail in the poster's full validator.
ANNOTATIONS = {"$schema", "$comment", "title", "description", "definitions"}
KEYWORDS = {"$ref", "type", "const", "enum", "properties", "required", "additionalProperties",
            "items", "minItems", "maxItems", "minLength", "pattern", "minimum", "allOf", "if",
            "then", "else"}
JSON_TYPES = {"object": dict, "array": list, "string": str, "integer": int,
              "number": (int, float), "null": type(None)}


def is_type(value, name):
    # bool is an int in Python, but never an integer or number in JSON.
    if isinstance(value, bool):
        return name == "boolean"
    return name != "boolean" and isinstance(value, JSON_TYPES[name])


def same(a, b):
    return type(a) is type(b) and a == b


def schema_errors(value, schema, root, where, errors):
    unknown = schema.keys() - KEYWORDS - ANNOTATIONS
    if unknown:
        raise ValueError(f"findings.schema.json uses unsupported keywords: {sorted(unknown)}")
    if "$ref" in schema:
        name = schema["$ref"].removeprefix("#/definitions/")
        schema_errors(value, root["definitions"][name], root, where, errors)
    if "type" in schema:
        types = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        if not any(is_type(value, t) for t in types):
            errors.append(f"{where}: must be {' or '.join(types)}, got {json.dumps(value)[:60]}")
            return
    if "const" in schema and not same(value, schema["const"]):
        errors.append(f"{where}: must be {json.dumps(schema['const'])}")
    if "enum" in schema and not any(same(value, option) for option in schema["enum"]):
        errors.append(f"{where}: must be one of {schema['enum']}, got {json.dumps(value)[:60]}")
    if isinstance(value, str):
        if len(value) < schema.get("minLength", 0):
            errors.append(f"{where}: must have at least {schema['minLength']} characters")
        if "pattern" in schema and not re.search(schema["pattern"], value):
            errors.append(f"{where}: {value[:60]!r} does not match {schema['pattern']}")
    if is_type(value, "integer") and value < schema.get("minimum", value):
        errors.append(f"{where}: must be at least {schema['minimum']}")
    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0):
            errors.append(f"{where}: must have at least {schema['minItems']} entries")
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            errors.append(f"{where}: must have at most {schema['maxItems']} entries")
        for index, item in enumerate(value):
            if "items" in schema:
                schema_errors(item, schema["items"], root, f"{where}[{index}]", errors)
    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                errors.append(f"{where}: missing required field {key!r}")
        properties = schema.get("properties", {})
        for key, item in value.items():
            if key in properties:
                schema_errors(item, properties[key], root, f"{where}.{key}", errors)
            elif schema.get("additionalProperties") is False:
                errors.append(f"{where}: unknown field {key!r}")
    for sub in schema.get("allOf", []):
        schema_errors(value, sub, root, where, errors)
    if "if" in schema:
        probe = []
        schema_errors(value, schema["if"], root, where, probe)
        branch = schema.get("then") if not probe else schema.get("else")
        if branch:
            schema_errors(value, branch, root, where, errors)


def git(*args):
    result = subprocess.run(["git", "--literal-pathspecs", *args], capture_output=True,
                            text=True, encoding="utf-8", errors="replace")
    return result.returncode, result.stdout


def added_ranges(base, head, path):
    """Line ranges on the head side that the diff adds or changes."""
    _, out = git("diff", "-U0", base, head, "--", path)
    ranges = []
    for match in re.finditer(r"^@@ -\S+ \+(\d+)(?:,(\d+))? @@", out, re.M):
        start, count = int(match.group(1)), int(match.group(2) or "1")
        if count:
            ranges.append((start, start + count - 1))
    return ranges


def check_review_log(data, errors, warnings):
    manifest_path = SKILLS_DIR / data["skill"] / "review.json"
    try:
        checks = json.loads(manifest_path.read_text(encoding="utf-8"))["checks"]
    except (OSError, ValueError, KeyError) as exc:
        errors.append(f"skill {data['skill']!r}: cannot read its checks from {manifest_path}: "
                      f"{exc}")
        return
    seen = [entry["check"] for entry in data["reviewLog"]]
    unknown = sorted(set(seen) - set(checks))
    if unknown:
        errors.append(f"reviewLog names checks {data['skill']} does not have: {', '.join(unknown)}")
    missing = [check for check in checks if check not in seen]
    if missing:
        errors.append(f"reviewLog is missing the checks: {', '.join(missing)}")
    repeated = sorted({check for check in seen if seen.count(check) > 1})
    if repeated:
        errors.append(f"reviewLog names these checks more than once: {', '.join(repeated)}")
    has_finding_entry = any(entry["outcome"] == "finding" for entry in data["reviewLog"])
    if data["findings"] and not has_finding_entry:
        warnings.append("there are findings, but no reviewLog entry has the outcome 'finding'")
    if has_finding_entry and not data["findings"]:
        warnings.append("a reviewLog entry says 'finding', but the findings list is empty")


def check_anchors(data, errors, warnings):
    head, base = data["reviewedCommit"], data["baseCommit"]
    code, actual_head = git("rev-parse", "HEAD")
    if code != 0 or head != actual_head.strip():
        errors.append(f"reviewedCommit {head} is not the checked-out HEAD")
    code, out = git("diff", "--name-only", "-z", base, head)
    if code != 0:
        errors.append(f"cannot diff baseCommit {base}..reviewedCommit {head}")
        return
    changed = set(filter(None, out.split("\0")))
    for index, finding in enumerate(data["findings"], start=1):
        where = f"finding {index}"
        path, start, end = finding["file"], finding["startLine"], finding["endLine"]
        length = len(finding["comment"])
        if length > LONG_COMMENT_CHARS:
            warnings.append(f"{where}: comment has {length} characters — too long?")
        if path is None:
            warnings.append(f"{where}: no file, so it is posted on the whole PR — is there no "
                            "line it belongs to?")
            continue
        if path not in changed:
            errors.append(f"{where}: {path} is not changed by this PR")
            continue
        code, content = git("show", f"{head}:{path}")
        if code != 0:
            errors.append(f"{where}: {path} does not exist at {head} (deleted file?)")
            continue
        if start is None:
            warnings.append(f"{where}: no lines, so it is posted on the whole of {path} — is "
                            "there no line it belongs to?")
            continue
        line_count = len(content.splitlines())
        if start > end:
            errors.append(f"{where}: startLine {start} is after endLine {end}")
        elif end > line_count:
            errors.append(f"{where}: endLine {end} is past the end of {path} ({line_count} lines)")
        elif not any(start <= hi + HUNK_SLACK_LINES and end >= lo - HUNK_SLACK_LINES
                     for lo, hi in added_ranges(base, head, path)):
            warnings.append(f"{where}: {path}:{start}-{end} lies outside the changed lines")


def check_against_pr(data, findings_path, errors):
    pr_path = findings_path.parent / "pr.json"
    if not pr_path.is_file():
        return
    try:
        pr = json.loads(pr_path.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError) as exc:
        errors.append(f"cannot read {pr_path}: {exc}")
        return
    if data["pullRequestId"] != pr.get("pullRequestId"):
        errors.append(f"pullRequestId {data['pullRequestId']} differs from pr.json "
                      f"({pr.get('pullRequestId')})")
    if data["status"] == "reviewed" and data["reviewedCommit"] != pr.get("sourceCommit"):
        errors.append(f"reviewedCommit differs from the sourceCommit in pr.json "
                      f"({pr.get('sourceCommit')}) — the review read the wrong head")


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 1
    findings_path = Path(sys.argv[1])
    try:
        data = json.loads(findings_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        print(f"ERROR: cannot read findings: {exc}")
        return 1
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))

    errors, warnings = [], []
    schema_errors(data, schema, schema, "$", errors)
    if not errors:
        check_against_pr(data, findings_path, errors)
        if data["status"] == "reviewed":
            check_review_log(data, errors, warnings)
            check_anchors(data, errors, warnings)

    for message in errors:
        print(f"ERROR: {message}")
    for message in warnings:
        print(f"WARNING: {message}")
    findings = data.get("findings") if isinstance(data, dict) else None
    count = len(findings) if isinstance(findings, list) else 0
    print(f"{count} findings, {len(errors)} errors, {len(warnings)} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
