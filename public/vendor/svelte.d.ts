import type { Action } from "svelte/action";
import type { TransitionConfig } from "svelte/transition";
import { type RevealOptions } from "./index.js";
export interface TransitionParams {
    /** Milliseconds before this element starts. Default 0. */
    delay?: number;
    /** Position in a list; multiplied by the stagger for that job. Default 0. */
    index?: number;
}
/** `in:rise` fades and lifts the element in. Use `index` on list items to stagger them. */
export declare function rise(node: Element, { delay, index }?: TransitionParams): TransitionConfig;
/** `out:leave` fades and drops the element out. Svelte removes the node when it finishes. */
export declare function leave(node: Element, { delay, index }?: TransitionParams): TransitionConfig;
/** `use:morph={active}` on an element whose two children are the off and on faces. */
export declare const morph: Action<HTMLElement, boolean>;
/** `use:reveal` observes the element; set targets: "children" to reveal its children. */
export declare const reveal: Action<HTMLElement, RevealOptions | undefined>;
