/**
 * Strata's browser entry. The screens live in `screens/` and share `state.ts`;
 * see docs/tech-debt.md TD-1 for the module map. Implements design/game-brief.md MVP 5-6.
 */
import './style.css';
import { boot } from './app';
import { hideSplash } from './splash';

try {
  boot();
} finally {
  hideSplash(); // sprint 21 A2: the first screen is ready (or boot failed: never leave the splash over an error)
}
