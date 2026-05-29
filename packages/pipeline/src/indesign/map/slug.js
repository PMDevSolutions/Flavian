// Slug helpers shared by the mapper's token builders. Derived tokens are always
// namespaced so they never overwrite the base theme's curated slugs.

/**
 * Turn an arbitrary name into a kebab-case slug fragment.
 *
 * @param {unknown} name
 * @returns {string}
 */
export function slugify(name) {
	return String(name ?? '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * Build a namespaced, collision-free slug from a name. Appends a numeric suffix
 * if the namespaced slug is already taken.
 *
 * @param {unknown} name
 * @param {string} namespace
 * @param {Set<string>} used  Slugs already in use (mutated by the caller after).
 * @param {string} [fallback] Used when the name slugifies to empty.
 * @returns {string}
 */
export function namespacedSlug(name, namespace, used, fallback = 'token') {
	const stem = slugify(name) || fallback;
	const base = namespace ? `${namespace}-${stem}` : stem;
	let slug = base;
	let n = 2;
	while (used.has(slug)) {
		slug = `${base}-${n}`;
		n += 1;
	}
	return slug;
}
