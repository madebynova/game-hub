/** "2026-09-12" -> "September 12, 2026" (or the short form), in the reader's locale. */
export function formatDate(iso: string, style: 'long' | 'short' = 'long'): string {
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
  })
}
