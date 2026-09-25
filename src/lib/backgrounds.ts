/**
 * Background images are sourced from `src/assets/backgrounds/`.
 * Drop any image file in that folder and it gets picked up on the next build —
 * filenames don't matter, nothing else needs editing.
 */
const modules = import.meta.glob(
  "../assets/backgrounds/*.{jpg,jpeg,png,webp,avif,gif,JPG,JPEG,PNG,WEBP,AVIF,GIF}",
  { eager: true, query: "?url", import: "default" },
);

export const backgrounds: string[] = Object.keys(modules)
  .sort()
  .map((key) => modules[key] as string);

/** One random pick per page load, shared across routes so switching tabs doesn't reshuffle. */
export const currentBackground: string =
  backgrounds.length > 0
    ? backgrounds[Math.floor(Math.random() * backgrounds.length)]
    : "";
