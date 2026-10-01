import { type Targets } from "./dom.js";
export interface RiseOptions {
    /** Animate the supplied elements or their direct children. Default "self". */
    targets?: "self" | "children";
    /** Milliseconds between each element. Default 70. */
    stagger?: number;
    /** Milliseconds before the first element. Default 0. */
    delay?: number;
}
/**
 * Fade and lift each target in, one after another. Returns one Animation per element.
 * An element already in motion continues from where it is instead of restarting hidden.
 */
export declare function rise(targets: Targets, { targets: scope, stagger, delay }?: RiseOptions): Animation[];
