import type { UpdateEntry } from '../types'

/**
 * Release notes and platform news.
 *
 * Add real entries here as things actually ship. Newest first is handled by
 * `sortedUpdates` below, so order in this array doesn't matter.
 *
 * Shape of an entry:
 *
 *   {
 *     id: 'my-game-0-4',
 *     gameSlug: 'my-game',         // omit for NOVA-wide news
 *     title: 'Update 0.4',
 *     date: '2026-01-20',          // ISO
 *     summary: 'One line, optional.',
 *     changes: [
 *       { label: 'Added', items: ['...'] },
 *       { label: 'Fixed', items: ['...'] },
 *     ],
 *   }
 */
export const updates: UpdateEntry[] = []

export const sortedUpdates: UpdateEntry[] = [...updates].sort((a, b) =>
  b.date.localeCompare(a.date),
)

export function updatesForGame(slug: string): UpdateEntry[] {
  return sortedUpdates.filter((update) => update.gameSlug === slug)
}

