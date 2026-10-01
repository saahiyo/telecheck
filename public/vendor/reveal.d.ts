import { type Targets } from "./dom.js";
export interface RevealOptions {
    /** Observe the supplied elements or their direct children. Default "self". */
    targets?: "self" | "children";
    /** Milliseconds between elements that enter the viewport together. Default 60. */
    stagger?: number;
    /** Scroll container to observe against. Default the viewport. */
    root?: Element | null;
}
/** Hide the targets now and rise each one the first time it scrolls into view. Returns disconnect. */
export declare function reveal(targets: Targets, { targets: scope, stagger, root }?: RevealOptions): () => void;
