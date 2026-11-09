/** Which "What's new" postings to show (D46, D52). Pure, so it is unit-tested without a DOM. */
import type { WhatsNewRelease } from '../strings';

/**
 * The postings to show, newest first: every release for the changelog Settings opens (`all`), or
 * only the newest for the card shown once on Home after an update.
 */
export function whatsNewReleases(releases: readonly WhatsNewRelease[], all: boolean): readonly WhatsNewRelease[] {
  return all ? releases : releases.slice(0, 1);
}
