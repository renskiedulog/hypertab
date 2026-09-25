# Backgrounds

Drop any number of images in this folder. On the next build the app picks one at
random per new tab.

- Filenames don't matter — nothing to register anywhere.
- Supported: `.jpg .jpeg .png .webp .avif .gif`
- Anything else in this folder (like this README) is ignored.

Wired up in `src/lib/backgrounds.ts` via `import.meta.glob`.
