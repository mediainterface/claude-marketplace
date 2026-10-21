#!/usr/bin/env python3
"""Post the findings file of an automated review to its pull request, one new thread per finding.

Usage: post_findings.py <findings.json> [--dry-run]

Run inside a git checkout of the PR's repository, signed in through the Azure CLI (az devops
login, or AZURE_DEVOPS_EXT_PAT in a pipeline). The checkout's origin picks server, project and
repository. The file format is described under "Post a findings file" in ../SKILL.md.

Comment texts are posted as they are and never interpreted, behind a header that names the
reviewer and the severity. Nothing is posted when the file is malformed (every finding is checked
before the first is posted), when its status is not "reviewed", when the PR is no longer active,
or when the PR head has moved past reviewedCommit — the line numbers would point at moved code,
and the newer push gets its own review. A thread that is already on the PR with the same anchor
and text is not posted again, so a repeated run of the same review adds nothing.

--dry-run prints the threads it would create and posts nothing. Exit code 0 when everything due
was posted or nothing was due, 1 on any error.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import unquote

API_VERSION = "7.1"
# German: comment texts on the server are German (ado-shared/REFERENCE.md, "German text").
SEVERITY_LABELS = {"blocker": "🔴 Blocker", "should": "🟡 Sollte"}
NAME = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
COMMIT = re.compile(r"^[0-9a-f]{40}$")
# The remote forms of ado-shared/REFERENCE.md, Step 0.
REMOTES = [
    re.compile(r"^https?://(?:[^@/]+@)?(?P<host>[^/]+)/(?P<collection>[^/]+)/(?P<project>[^/]+)"
               r"/_git/(?P<repo>[^/]+?)/?$"),
    re.compile(r"^ssh://(?:[^@/]+@)?(?P<host>[^/:]+)(?::\d+)?/(?P<collection>[^/]+)"
               r"/(?P<project>[^/]+)/_git/(?P<repo>[^/]+?)/?$"),
    re.compile(r"^(?:[^@/]+@)?(?P<host>[^:/]+):(?P<collection>[^/]+)/(?P<project>[^/]+)"
               r"/_git/(?P<repo>[^/]+?)/?$"),
]


class Failure(Exception):
    pass


def run(cmd):
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                            errors="replace", env=env)
    if result.returncode != 0:
        raise Failure(f"{' '.join(cmd[:4])} … failed:\n{result.stderr.strip()}")
    return result.stdout


def az(*args):
    path = shutil.which("az")
    if not path:
        raise Failure("Azure CLI not found — install it and the azure-devops extension")
    return json.loads(run([path, *args, "-o", "json"]))


def connection():
    url = run(["git", "remote", "get-url", "origin"]).strip()
    for pattern in REMOTES:
        match = pattern.match(url)
        if match:
            scheme = "http" if url.startswith("http://") else "https"
            host = match["host"] if url.startswith("http") else match["host"].split(":")[0]
            return (f"{scheme}://{host}/{unquote(match['collection'])}",
                    unquote(match["project"]), unquote(match["repo"]))
    raise Failure(f"origin {url} is not an Azure DevOps repository")


def check(data):
    """Every reason not to post, before anything is posted."""
    errors = []
    if not isinstance(data, dict):
        return ["the file is not a JSON object"]
    if data.get("schemaVersion") != 1:
        errors.append(f"schemaVersion {data.get('schemaVersion')!r} is not 1")
    if not isinstance(data.get("skill"), str) or not NAME.match(data["skill"]):
        errors.append("skill must be a kebab-case name")
    if data.get("status") not in ("reviewed", "skipped", "error"):
        errors.append("status must be reviewed, skipped or error")
    pr_id = data.get("pullRequestId")
    if not isinstance(pr_id, int) or isinstance(pr_id, bool) or pr_id < 1:
        errors.append("pullRequestId must be a positive integer")
    if data.get("status") != "reviewed":
        return errors
    if not isinstance(data.get("reviewedCommit"), str) or not COMMIT.match(data["reviewedCommit"]):
        errors.append("reviewedCommit must be a full commit SHA")
    findings = data.get("findings")
    if not isinstance(findings, list):
        return errors + ["findings must be a list"]
    for index, finding in enumerate(findings, start=1):
        where = f"finding {index}"
        if not isinstance(finding, dict):
            errors.append(f"{where}: not an object")
            continue
        if finding.get("severity") not in SEVERITY_LABELS:
            errors.append(f"{where}: severity must be one of {sorted(SEVERITY_LABELS)}")
        if not isinstance(finding.get("comment"), str) or not finding["comment"].strip():
            errors.append(f"{where}: comment is empty")
        path, start, end = finding.get("file"), finding.get("startLine"), finding.get("endLine")
        lines_ok = all(v is None or (isinstance(v, int) and not isinstance(v, bool) and v >= 1)
                       for v in (start, end))
        if path is not None and (not isinstance(path, str) or not path
                                 or path.startswith(("/", "\\"))):
            errors.append(f"{where}: file must be repo-relative, without a leading slash")
        elif not lines_ok or (start is None) != (end is None) or (path is None and start):
            errors.append(f"{where}: anchor must be file + startLine + endLine, file alone, "
                          "or none of them")
        elif start is not None and start > end:
            errors.append(f"{where}: startLine {start} is after endLine {end}")
    return errors


def end_offset(commit, path, line):
    """Offset just past the last character of the anchor's end line, so the whole range is
    marked; 1 (the line start, which the server accepts too) when the file cannot be read."""
    try:
        lines = run(["git", "show", f"{commit}:{path}"]).splitlines()
        return len(lines[line - 1]) + 1
    except (Failure, IndexError):
        return 1


def thread_body(data, finding):
    header = f"🤖 **KI-Review** · `{data['skill']}` · {SEVERITY_LABELS[finding['severity']]}"
    body = {
        "comments": [{"parentCommentId": 0, "content": f"{header}\n\n{finding['comment'].strip()}",
                      "commentType": "text"}],
        "status": "active",
    }
    path, start, end = finding["file"], finding["startLine"], finding["endLine"]
    if path is not None:
        body["threadContext"] = {"filePath": f"/{path}"}
    if start is not None:
        body["threadContext"]["rightFileStart"] = {"line": start, "offset": 1}
        body["threadContext"]["rightFileEnd"] = {
            "line": end, "offset": end_offset(data["reviewedCommit"], path, end)}
    return body


def anchor_key(thread_context):
    context = thread_context or {}
    return (context.get("filePath"), (context.get("rightFileStart") or {}).get("line"))


def normalized(text):
    return text.replace("\r\n", "\n").strip()


def main(argv):
    args = [a for a in argv if a != "--dry-run"]
    dry_run = len(args) != len(argv)
    if len(args) != 1:
        print(__doc__)
        return 1
    with open(args[0], encoding="utf-8-sig") as handle:
        data = json.load(handle)
    errors = check(data)
    if errors:
        raise Failure("nothing posted, the findings file is malformed:\n- " + "\n- ".join(errors))
    skill, pr_id = data["skill"], data["pullRequestId"]
    if data["status"] != "reviewed":
        print(f"{skill}: {data['status']}, nothing to post — "
              f"{data.get('reason') or 'no reason given'}")
        return 0

    org, project, repo = connection()
    pr = az("repos", "pr", "show", "--id", str(pr_id), "--org", org)
    if pr["repository"]["name"] != repo:
        raise Failure(f"PR {pr_id} belongs to repository {pr['repository']['name']}, the "
                      f"checkout to {repo}")
    if pr["status"] != "active":
        print(f"{skill}: PR {pr_id} is {pr['status']}; nothing posted")
        return 0
    head = pr["lastMergeSourceCommit"]["commitId"]
    if head != data["reviewedCommit"]:
        print(f"{skill}: PR {pr_id} moved on to {head[:9]}, the review read "
              f"{data['reviewedCommit'][:9]}; nothing posted")
        return 0

    threads_route = ["--area", "git", "--resource", "pullRequestThreads", "--route-parameters",
                     f"project={project}", f"repositoryId={repo}", f"pullRequestId={pr_id}",
                     "--org", org, "--api-version", API_VERSION]
    existing = set()
    for thread in az("devops", "invoke", *threads_route)["value"]:
        for comment in thread.get("comments", []):
            if comment.get("commentType") != "system" and not comment.get("isDeleted"):
                existing.add((anchor_key(thread.get("threadContext")),
                              normalized(comment.get("content") or "")))

    posted = skipped = 0
    for index, finding in enumerate(data["findings"], start=1):
        body = thread_body(data, finding)
        key = (anchor_key(body.get("threadContext")), normalized(body["comments"][0]["content"]))
        if key in existing:
            skipped += 1
            print(f"finding {index}: already on the PR, skipped")
            continue
        if dry_run:
            print(f"finding {index}: would post\n{json.dumps(body, ensure_ascii=False, indent=2)}")
            continue
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".json",
                                         delete=False) as handle:
            json.dump(body, handle, ensure_ascii=False)
        try:
            thread = az("devops", "invoke", *threads_route, "--http-method", "POST", "--in-file",
                        handle.name, "--media-type", "application/json")
        finally:
            os.unlink(handle.name)
        posted += 1
        print(f"finding {index}: posted as thread {thread['id']}")
    verb = "would post" if dry_run else "posted"
    print(f"{skill}: {verb} {len(data['findings']) - skipped if dry_run else posted}, "
          f"{skipped} already on PR {pr_id}")
    return 0


if __name__ == "__main__":
    # The bodies carry emoji and umlauts; a Windows console defaults to cp1252.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    try:
        sys.exit(main(sys.argv[1:]))
    except (Failure, OSError, ValueError, KeyError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
