# Gemini CLI & Antigravity

@AGENTS.md

Gemini-specific notes (everything else is in `AGENTS.md`, which every agent reads):

- Skills live in `skills/` and are linked at `.gemini/skills` and `.agent/skills` so Gemini CLI and
  Antigravity discover them automatically. Read the relevant `skills/<name>/SKILL.md` before starting a task.
- Use your session scratchpad (or a local scratch folder outside `output/`) for exploration scripts,
  sketches (`node pipeline/make.mjs <name> --dir=sketches --out=<scratch>`) and contact sheets. Never write
  scratch files into `output/`.
- Cold read (step 7 of the workflow): `node pipeline/qa/cold_read.mjs <chart>` automatically uses `gemini`
  (or `claude` if installed; pass `--cli=gemini` to force Gemini CLI). Inside Antigravity, you can also
  run a cold read by invoking a fresh `research` subagent with only the rendered feed PNG path and the
  four cold-read questions from `pipeline/qa/cold_read.mjs`.
- Status and history: `CHANGELOG.md`.

