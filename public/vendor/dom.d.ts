/** A selector, one element, or anything iterable of elements (NodeList, HTMLCollection, array). */
export type Targets = string | Element | Iterable<Element>;
export declare const calm: () => boolean;
export declare const list: (targets: Targets, scope?: "self" | "children") => Element[];
/** Cancel everything running on the element so a new motion never stacks on an old fill. */
export declare const clear: (el: Element) => void;
/** True while any animation is running or filling on the element. */
export declare const moving: (el: Element) => boolean;
/**
 * The element's current opacity and transform-related values, read before `clear` so a
 * motion that interrupts another continues from where it is instead of snapping to a
 * fixed first keyframe. Only the keys asked for are returned.
 */
export declare const current: (el: Element, keys: ("opacity" | "translate" | "scale" | "filter")[]) => Keyframe;
