import { type Targets } from "./dom.js";
export interface LeaveOptions {
    /** Animate the supplied elements or their direct children. Default "self". */
    targets?: "self" | "children";
    /** Milliseconds between each element. Default 40. */
    stagger?: number;
    /** Milliseconds before the first element. Default 0. */
    delay?: number;
}
/**
 * Fade and drop each target out, one after another. The end state holds until you
 * remove the element or rise it again. Returns one Animation per element, so
 * `await Promise.all(leave(el).map((a) => a.finished))` before unmounting.
 * An element already in motion continues from where it is.
 */
export declare function leave(targets: Targets, { targets: scope, stagger, delay }?: LeaveOptions): Animation[];
