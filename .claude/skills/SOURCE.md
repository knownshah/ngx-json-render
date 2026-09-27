# Source of the vendored skills

`task-tracker/` and `verification/` are verbatim copies from:

- Repository: https://github.com/shteynu/agent-skills
- Commit: a5bd76bfed6f227064026eeaf17b7eed0ffca0be
- Copied: 2026-08-29

A copy is a fork that drifts silently. To refresh, re-copy the skill
directories from the upstream repository and update the commit above.

## Local deviation: hidden from the skills CLI

Both frontmatters carry two lines the upstream files do not have:

    metadata:
      internal: true

The skills CLI (`npx skills add …`) scans `.claude/skills/` as well as
`skills/`, so without the flag `npx skills add shteynu/ngx-json-render`
offers these two process skills next to the package skills. `metadata.internal`
hides them from that listing (they install only with
`INSTALL_INTERNAL_SKILLS=1`) and changes nothing for Claude Code, which loads
them from this directory as before. When refreshing, re-copy the files and add
the two lines back; apart from them the copies stay byte-identical to upstream.
