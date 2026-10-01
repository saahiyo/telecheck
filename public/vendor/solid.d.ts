import { type ComponentProps, type JSX, type ValidComponent } from "solid-js";
import { type RevealOptions, type RiseOptions } from "./index.js";
type Props<T extends ValidComponent, Own> = Own & {
    as?: T;
} & Omit<ComponentProps<T>, keyof Own | "as">;
interface RiseProps extends RiseOptions {
    /** Mounted and risen while true; leaves, then unmounts, when it turns false. Default true. */
    show?: boolean;
}
/** Rises on mount and leaves before unmount. Use targets="children" for direct children. Renders a div by default. */
export declare function Rise<T extends ValidComponent = "div">(props: Props<T, RiseProps>): JSX.Element;
interface MorphProps {
    active: boolean;
    off: JSX.Element;
    on: JSX.Element;
}
/** Two stacked faces. Shows `on` when active, `off` otherwise, morphing between them. */
export declare function Morph<T extends ValidComponent = "span">(props: Props<T, MorphProps>): JSX.Element;
/** Reveals as it scrolls into view. Use targets="children" for direct children. Renders a div by default. */
export declare function Reveal<T extends ValidComponent = "div">(props: Props<T, RevealOptions>): JSX.Element;
export {};
