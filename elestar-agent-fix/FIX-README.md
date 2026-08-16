# elestar-agent — two fixes

The repo is public and downloads fine. Two things were actually broken.

## 1. `.claude-plugin/plugin.json` is missing — this is why it "doesn't work"

The manifest is the only required file in a Claude Code plugin. Without it the
directory is just markdown and TypeScript; nothing loads it as a plugin.

It vanished because GitHub's drag-and-drop web uploader **silently skips
dot-directories**. `.claude-plugin/` never made it up. There are zero dotfiles
anywhere in the repo, which is the tell.

Fix — from a clone, on the command line rather than the web uploader:

```bash
git clone https://github.com/barneysmith-sys/elestar-agent
cd elestar-agent
mkdir -p elestar-agents/.claude-plugin
# copy the plugin.json from this bundle into that directory
git add -f elestar-agents/.claude-plugin/plugin.json
git commit -m "Add plugin manifest (dropped by web upload)"
git push
```

The `-f` matters if a `.gitignore` ever starts ignoring dotfiles.

## 2. Two type errors in `src/parseProcess.ts`

`tsconfig.json` sets `noUncheckedIndexedAccess: true`, so `ORDER[i]` is
`Tier | undefined`, and both tier-step lines fail to compile:

```
src/parseProcess.ts(74,7): error TS2322: Type 'Tier | undefined' is not assignable to type 'Tier'.
src/parseProcess.ts(80,5): error TS2322: Type 'Tier | undefined' is not assignable to type 'Tier'.
```

My bug, not yours. Fixed by a clamped `step()` helper — replace
`src/parseProcess.ts` with the copy in this bundle.

After that, verified locally:

```
tsc --noEmit    -> clean
tsx evals/run.ts -> 7 passed, 0 failed
```

(The parser eval cases skip without `ANTHROPIC_API_KEY`; the tier and redaction
checks run offline.)

## 3. Repo layout — worth deciding

Right now the root holds `elestar-agents/` plus a stray `elestar-app.html`.
For the plugin to install cleanly, the manifest needs to sit at
`elestar-agents/.claude-plugin/plugin.json` and people install that
subdirectory, not the repo root.

Simpler: move the contents of `elestar-agents/` up to the repo root so
`.claude-plugin/` is top-level, and put `elestar-app.html` in `web/` or its own
repo. Then the whole repo is the plugin.
