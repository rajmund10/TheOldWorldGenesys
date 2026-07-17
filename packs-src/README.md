# Pack Sources

This directory is the source of truth for generated Foundry compendia.

Edit documents here instead of editing `public/packs` directly. The build step
validates these files and, when the optional `classic-level` package is
available, writes Foundry LevelDB packs into `public/packs`.

Current flow:

```bash
yarn build
```

Pack generation is intentionally non-destructive when `classic-level` is not
installed, so an existing working Foundry pack is not removed by accident.
