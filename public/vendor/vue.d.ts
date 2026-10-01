import { type Component, type DefineComponent } from "vue";
import { type RiseOptions, type RevealOptions } from "./index.js";
type As = string | Component;
/** Rises on mount and leaves before unmount. Use targets="children" for direct children. Renders a div by default. */
export declare const Rise: DefineComponent<RiseOptions & {
    as?: As;
    show?: boolean;
}>;
/** Two stacked faces. Shows `on` when active, `off` otherwise, morphing between them. Faces come from props or the `off` and `on` slots. */
export declare const Morph: DefineComponent<{
    as?: As;
    active: boolean;
    off?: string;
    on?: string;
}>;
/** Reveals as it scrolls into view. Use targets="children" for direct children. Renders a div by default. */
export declare const Reveal: DefineComponent<RevealOptions & {
    as?: As;
}>;
export {};
