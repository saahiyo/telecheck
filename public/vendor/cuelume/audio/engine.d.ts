/**
 * The audio engine — synthesizes each sound live via the Web Audio API
 * on one shared, lazily created `AudioContext`. No audio files, no
 * dependencies. Every sound carries a gentle envelope instead of a hard
 * transient, so nothing feels harsh, and every sound rings faintly into one
 * shared room, so it sounds placed in a space rather than inside your head.
 *
 * Each layer swells in along a straight line and dies away exponentially. A
 * straight swell is heard from its first moment; an exponential one stays
 * silent for most of its length and then jumps in, heard as a late second hit.
 */
import { type LegacySoundName, type SoundName } from "../sounds/recipes.js";
import { type Context, type Emphasis, type InputMethod, type KeyRole } from "../sounds/context.js";
import { type ThemeName } from "../sounds/themes.js";
/** Enables or disables future playback. Preference storage stays with the app. */
export declare function setEnabled(value: boolean): void;
/**
 * Switches the material of future playback. Sounds already playing finish as
 * they started; unknown names are ignored. Preference storage stays with the app.
 */
export declare function setTheme(theme: ThemeName): void;
/** Sets the volume multiplier for future playback. Preference storage stays with the app. */
export declare function setVolume(value: number): void;
export type PlayOptions = {
    /** Multiplier for this play only, clamped to 0–1. */
    volume?: number;
    /** How much the action matters. Invalid values play as "normal". */
    emphasis?: Emphasis;
    /** Which way the interaction moved. Shapes `select`; `back` plays `navigate`, `toggle` and `count` backwards. */
    direction?: "forward" | "back";
    /** Which key was typed. Shapes `type`. */
    key?: KeyRole;
    /** What did the activating. Shapes `tap`. */
    input?: InputMethod;
    /** How long a `count` runs, in milliseconds, clamped to 300–2000. Other cues ignore it. */
    duration?: number;
    /** The material for this play only; the active theme is unchanged. Unknown names play the active theme. */
    theme?: ThemeName;
};
/**
 * Plays a sound immediately. Safe to call from anywhere — lazily creates
 * the shared `AudioContext` on first use, resumes it if the browser
 * started it suspended (e.g. before any user gesture), and is a no-op
 * when Web Audio is unavailable (SSR, old browsers).
 */
export declare function play(sound?: SoundName, options?: PlayOptions): void;
/** @deprecated Renamed in v0.3 and removed in 1.0. See the migration table in the README. */
export declare function play(sound: LegacySoundName, options?: PlayOptions): void;
/** `play`, plus what a binding knows about the interaction. Internal to cuelume. */
export declare function playInContext(sound: unknown, options: PlayOptions | undefined, interaction: Context): void;
