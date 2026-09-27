#!/usr/bin/env bash
# The reporting half of .github/workflows/core-canary.yml, kept as a script
# so it can be dry-run with a stubbed `gh`: scripts/lib/core-canary-report.test.mjs
# covers the four outcomes and runs under `npm run test:scripts`.
#
# Inputs (environment): LATEST, RANGE, PINNED, ADMITTED ("true"/"false"),
# OUTCOMES ("step=outcome ..." for install, build_lib, test_lib,
# build_material, test_material; an outcome is success, failure, or skipped),
# RUN_URL, GH_TOKEN.
#
# Exit 0 when the newest core is admitted and every step succeeded (and closes
# any issue the canary opened earlier); exit 1 otherwise, after making sure an
# issue for this core version is open.
set -euo pipefail

LABEL=core-canary
FAILED=""
for pair in $OUTCOMES; do
  case "$pair" in
    *=success) ;;
    *=skipped) ;; # skipped only because an earlier step failed; that one is listed
    *) FAILED="$FAILED ${pair%%=*}" ;;
  esac
done

if [ "$ADMITTED" = "true" ] && [ -z "$FAILED" ]; then
  echo "core $LATEST is admitted by '$RANGE' and the suite passes against it."
  for n in $(gh issue list --label "$LABEL" --state open --json number --jq '.[].number'); do
    gh issue close "$n" --comment "The newest \`@json-render/core\` ($LATEST) is admitted by \`$RANGE\` and the suite passes against it: $RUN_URL"
  done
  exit 0
fi

if [ "$ADMITTED" = "true" ]; then
  TITLE="core canary: the suite fails against @json-render/core $LATEST"
else
  TITLE="core canary: @json-render/core $LATEST is outside $RANGE"
fi

EXISTING=$(gh issue list --label "$LABEL" --state open --search "\"$LATEST\" in:title" --json number,title --jq ".[] | select(.title | contains(\"$LATEST\")) | .number" | head -1)
if [ -n "$EXISTING" ]; then
  echo "issue #$EXISTING is already open for core $LATEST; not opening another."
  exit 1
fi

gh label create "$LABEL" --description "Opened by the core canary workflow" --color 1D76DB 2>/dev/null || true

if [ -z "$FAILED" ]; then
  RESULT="Against $LATEST the library and the Material catalog build and their suites pass, so admitting it is a manifest change."
else
  RESULT="Against $LATEST these steps failed:$FAILED (the ones after a failure are skipped)."
fi

BODY=$(cat <<MD
The newest \`@json-render/core\` is **$LATEST**. Both packages admit \`$RANGE\` and the workspace pins $PINNED.

$RESULT

Run: $RUN_URL

What to do (from AGENTS.md, *core-compat*): move the workspace (\`npm install @json-render/core@^${LATEST%%.*}.${LATEST#*.}\` — same for \`@json-render/directives\`), widen the peer range in **both** package manifests, keep the floor in the \`core-compat\` matrix, fix whatever failed, and release both packages, renderer first.

This issue is closed automatically by the first canary run that finds the newest core admitted and green.
MD
)
gh issue create --title "$TITLE" --label "$LABEL" --body "$BODY"
exit 1
