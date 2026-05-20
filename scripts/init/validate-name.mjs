const RESERVED = new Set([
  'wp-admin', 'wp-content', 'wp-includes', 'akismet', 'hello',
  'index', 'wordpress', 'admin', 'twentytwentyfive',
]);

/**
 * Returns null if valid, otherwise an error string suitable for display.
 */
export function validateProjectName(value) {
  if (!value || value.trim() === '') return 'Project name is required';
  if (value.length < 2) return 'Must be at least 2 characters';
  if (value.length > 40) return 'Must be at most 40 characters';
  if (!/^[a-zA-Z]/.test(value)) return 'Must start with a letter (a-z)';
  if (!/^[a-z][a-z0-9-]*$/.test(value)) {
    return 'Must be lowercase kebab-case (letters, digits, hyphens)';
  }
  if (RESERVED.has(value)) return `"${value}" is a reserved WordPress slug`;
  return null;
}
