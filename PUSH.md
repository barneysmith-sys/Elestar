# Pushing this to barneysmith-sys/elestar-agent

This tree is the repo, corrected and restructured. I can't push it myself —
no write access to your GitHub account — so this is the part you run.

## What changed vs what's on main now

1. **Added `.claude-plugin/plugin.json`.** It was missing entirely. This is the
   only required file in a Claude Code plugin, so without it nothing loads the
   repo as a plugin. It vanished because GitHub's drag-and-drop web uploader
   silently skips dot-directories — there are currently zero dotfiles anywhere
   in the repo, which is the tell. **Do not re-upload through the browser.**
2. **Fixed two type errors in `src/parseProcess.ts`.** `noUncheckedIndexedAccess`
   made `ORDER[i]` return `Tier | undefined`. Replaced with a clamped `step()`
   helper. My bug.
3. **Flattened the layout.** Everything moved from `elestar-agents/` up to the
   root, so `.claude-plugin/` is top-level and the repo *is* the plugin — people
   install the repo URL rather than a subdirectory.
4. **Moved the prototype** to `web/elestar-app.html`.
5. **Added `.gitignore`** for `node_modules/`, lockfile and `.env`.

Verified before packaging: `tsc --noEmit` clean, `tsx evals/run.ts` 7 passed 0 failed.

## Push it

```bash
git clone https://github.com/barneysmith-sys/elestar-agent
cd elestar-agent

# clear the old layout (keeps .git)
git rm -r --cached . -q
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +

# unzip this bundle's contents into the repo root, then:
git add -A
git status            # confirm .claude-plugin/plugin.json is staged
git commit -m "Add plugin manifest, fix tier indexing, flatten layout"
git push
```

`git status` must list `.claude-plugin/plugin.json`. If it doesn't, run
`git add -f .claude-plugin/plugin.json` — that's the file that went missing last
time and it's the whole reason the plugin didn't work.

## Then verify

```bash
npm install
npx tsc --noEmit
npx tsx evals/run.ts
```
