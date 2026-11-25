/**
 * Card images live in src/assets/cards and are matched to facts by file name:
 * "sci-03.webp" is the picture for fact "sci-03". Cards without a file fall
 * back to generated line art, so images can be added a few at a time.
 */
const files = import.meta.glob('../assets/cards/*.{webp,avif,jpg,jpeg,png}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

export const IMAGE_BY_ID = new Map(
  Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace(/\.\w+$/, ''), url]),
)
