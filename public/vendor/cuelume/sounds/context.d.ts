/**
 * Context-aware shaping: how a cue bends to the interaction that played it.
 *
 *   semantic cue + interaction context + emphasis = rendered sound
 *
 * A shape scales a recipe's pitch, level, and length, plus its bright layers
 * (centred at or above BRIGHT_HZ) and its tail (layers that start late). Every
 * factor is curated here and clamped, so a cue always stays recognisably itself
 * and context that is missing leaves the canonical sound untouched.
 */
import type { SoundLayer, SoundName } from "./recipes.js";
export type Emphasis = "subtle" | "normal" | "strong";
export type InputMethod = "mouse" | "touch" | "pen" | "keyboard";
export type KeyRole = "printable" | "space" | "delete" | "enter";
export type Context = {
    input?: InputMethod;
    key?: KeyRole;
    direction?: 1 | -1;
    duration?: number;
};
/** `sweep` is 1, or -1 to play a cue's glides backwards. `time` moves when layers start. */
export type Shape = {
    pitch: number;
    level: number;
    length: number;
    bright: number;
    tail: number;
    sweep: number;
    time: number;
};
/** The layers an emphasis plays: subtle strips ornament, strong adds its own layer. */
export declare function arrangement(layers: SoundLayer[], emphasis: Emphasis): SoundLayer[];
export declare function resolveEmphasis(value: unknown): Emphasis;
/**
 * The context a caller passed to `play()`, in the shape bindings produce.
 * Unknown values are left out, so the cue plays as it would with none.
 */
export declare function contextFrom(options: {
    direction?: unknown;
    key?: unknown;
    input?: unknown;
    duration?: unknown;
} | null | undefined): Context;
/** The combined shape for one play of `sound`. */
export declare function shapeFor(sound: SoundName, context: Context, emphasis: Emphasis, sinceLastMs: number): Shape;
/** What `shape` does to one layer, bounded so no context can run away with a cue. */
export declare function layerFactors(layer: SoundLayer, shape: Shape): {
    pitch: number;
    gain: number;
    length: number;
};
