export function slugify(input) {
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function titleCase(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}
