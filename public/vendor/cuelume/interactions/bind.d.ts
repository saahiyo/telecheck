/**
 * Declarative binding — one call to `bind()` wires up every element
 * carrying a `data-cuelume-*` attribute:
 *
 *   data-cuelume-tap       → click
 *   data-cuelume-type      → keydown that edits text (the marked field only)
 *   data-cuelume-select    → change on a native <select>/<input>, otherwise click
 *   data-cuelume-toggle    → click
 *   data-cuelume-open      → click
 *   data-cuelume-close     → click
 *   data-cuelume-navigate  → click
 *
 * Deprecated, kept for the v0.3 migration window and removed in 1.0:
 *
 *   data-cuelume-hover     → pointerenter (fine mouse, throttled), plays `select`
 *   data-cuelume-press     → pointerdown, plays `tap`
 *   data-cuelume-release   → pointerup, plays `tap` unless the element also has press
 *
 * Delegated listeners resolve attributes when each event fires, so later
 * DOM additions, removals, and clones work without rescanning. When
 * annotated elements nest, the innermost one decides the cue.
 *
 * Each binding also passes along what the event says about the interaction:
 * the key pressed, which way a selection moved, whether a toggle is switching
 * on or off, and what did the clicking. `data-cuelume-emphasis`, on the
 * element or any ancestor, sets how much the action matters, and
 * `data-cuelume-theme` sets the material the same way. Nothing is stored
 * beyond the page's memory.
 */
/**
 * Delegates `data-cuelume-*` interactions under `root` (default: the whole
 * document). Safe during SSR and safe to call repeatedly for the same root.
 */
export declare function bind(root?: ParentNode): void;
