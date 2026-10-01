import { type ComponentPropsWithoutRef, type ComponentPropsWithRef, type ElementType, type ReactElement, type ReactNode, type RefObject } from "react";
import { type RevealOptions, type RiseOptions } from "./index.js";
type Ref<T extends Element> = RefObject<T | null>;
/** Returns a ref. The element rises on attachment; use targets="children" for its direct children. */
export declare function useRise<T extends Element = HTMLElement>(options?: RiseOptions): Ref<T>;
/** Returns [off, on] refs. `on` shows when active. Morphs on change, settles without motion on mount. */
export declare function useMorph<T extends Element = HTMLElement>(active: boolean): [Ref<T>, Ref<T>];
/** Returns a ref. The element reveals as it scrolls into view; use targets="children" for its direct children. */
export declare function useReveal<T extends Element = HTMLElement>(options?: RevealOptions): Ref<T>;
type Props<T extends ElementType, Own> = Own & {
    as?: T;
} & Omit<ComponentPropsWithoutRef<T>, keyof Own | "as">;
type PolyRef<T extends ElementType> = "ref" extends keyof ComponentPropsWithRef<T> ? ComponentPropsWithRef<T>["ref"] : never;
type Poly<D extends ElementType, Own> = <T extends ElementType = D>(props: Props<T, Own> & {
    ref?: PolyRef<T>;
}) => ReactElement | null;
interface RiseProps extends RiseOptions {
    /** Mounted and risen while true; leaves, then unmounts, when it turns false. Default true. */
    show?: boolean;
}
/** Rises on mount and leaves before unmount. Use targets="children" for direct children. Renders a div by default. */
export declare const Rise: Poly<"div", RiseProps>;
interface MorphProps {
    active: boolean;
    off: ReactNode;
    on: ReactNode;
}
/** Two stacked faces. Shows `on` when active, `off` otherwise, morphing between them. */
export declare const Morph: Poly<"span", MorphProps>;
/** Reveals as it scrolls into view. Use targets="children" for direct children. Renders a div by default. */
export declare const Reveal: Poly<"div", RevealOptions>;
export {};
