/**
 * The sound palette — layer/recipe types plus the fourteen canonical cues.
 * Each cue names an interface job, not a synthesis style, and has its own
 * distinct shape rather than being a volume/EQ tweak on the same click.
 * Retired v0.2 names live on as aliases until 1.0.
 */
type BaseLayer = {
    /** Seconds after the trigger that this layer starts. */
    offset?: number;
    /** Fade-in time, in seconds. */
    attack: number;
    /** Fade-out time, in seconds, starting right after the attack. */
    decay: number;
    /** Peak volume reached at the end of the attack. */
    peak: number;
    /** If set, the layer's pitch (a tone's frequency, a noise layer's filter) glides to this value. */
    glideTo?: number;
    /** How long the glide takes, in seconds. Defaults to attack + decay. */
    glideTime?: number;
    /**
     * The lowest emphasis this layer plays at. Unset plays at every level;
     * "normal" drops out of subtle; "strong" plays only when strong.
     */
    from?: "normal" | "strong";
    /** For `count`: this layer lasts as long as the count, not only starts in step with it. */
    stretch?: true;
};
/** A single note — the building block for chimes, arpeggios, and pads. */
export type ToneLayer = BaseLayer & {
    kind: "tone";
    waveform: OscillatorType;
    frequency: number;
    /** Detune in cents, for a gentle chorus/beating effect between layers. */
    detune?: number;
};
/** Filtered noise — clicks, knocks, and air. */
export type NoiseLayer = BaseLayer & {
    kind: "noise";
    filterType: BiquadFilterType;
    filterFrequency: number;
    filterQ?: number;
};
export type SoundLayer = ToneLayer | NoiseLayer;
/** Per-play randomness, as fractions: each layer's pitch and level move by up to ± these. */
export type Variation = {
    pitch: number;
    level: number;
};
export type SoundRecipe = {
    masterGain: number;
    layers: SoundLayer[];
    /**
     * How strongly this cue rings into the shared room, as a multiple of every
     * cue's faint send. Results that land ring in it more.
     */
    room?: number;
    vary?: Variation;
};
/**
 * Success and ready ring into the room 6 dB more than the rest, about 16 dB
 * under the sound itself: a result lands in the space without sounding far.
 */
export declare const LANDED = 2;
/**
 * A knock's body: a sine struck sharp that drops to `frequency` in 18 ms, the
 * way a small hollow part answers a tap. Heard as a soft "tok", never as a
 * slide. Measured from the keycap sounds in DawoodUI's Artasaka preview.
 */
export declare const knock: (frequency: number, decay: number, peak: number, more?: Partial<ToneLayer>) => ToneLayer;
/**
 * A struck object's modes as [ratio to the fundamental, level] pairs. The
 * ratios are what tells the ear "bar" rather than "synth": real bars are
 * inharmonic.
 */
type Material = readonly (readonly [ratio: number, level: number])[];
/** A free bar, glass or metal: modes at 1, 2.76 and 5.40 times the fundamental (euphonics.org, free-free bar). */
export declare const BAR: Material;
/** A marimba bar, undercut so its second mode sits at 3.99x (STK ModalBar's marimba). Rounder than a free bar. */
export declare const MALLET: Material;
/**
 * A struck note: one sine per mode of `material`. Each mode dies in inverse
 * proportion to its pitch, so the highs go first as on any real bar (decay
 * time falls as 1/f, van den Doel and Pai). Upper modes are ornament that
 * subtle leaves out; `from` moves the whole note to a higher emphasis.
 */
export declare function struck(frequency: number, decay: number, peak: number, material: Material, { from }?: {
    from?: "normal" | "strong";
}): ToneLayer[];
/**
 * The mallet meeting the bar: 3 ms of noise, low-passed at the mallet's
 * hardness. A soft felt mallet sits near 1 kHz, a hard one near 3 kHz. It
 * makes a chord a struck object rather than a test tone.
 */
export declare const contact: (hardness: number, peak: number, more?: Partial<NoiseLayer>) => NoiseLayer;
export declare const RECIPES: {
    /**
     * A small glassy tap — buttons, links, nav. A nail's tick, a soft knock of
     * body, then the glass ringing briefly: the fundamental is two near-identical modes that beat
     * slowly, as real glass shimmers, and the upper mode sits at the glass-bar
     * ratio 2.76x, dying faster than the fundamental.
     */
    tap: {
        masterGain: number;
        layers: (ToneLayer | {
            from: "normal";
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
        })[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /**
     * One keyboard keystroke — the switch's click, the keycap's clack, and the
     * thock of bottoming out, all in one strike. Every stroke
     * lands at a slightly different pitch and weight, like different keys.
     */
    type: {
        masterGain: number;
        layers: ({
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            from?: undefined;
        } | {
            from: "normal";
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
        } | {
            from: "strong";
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
        })[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** A crisp detent over a small wooden knock — dropdowns, menus, lists. */
    select: {
        masterGain: number;
        layers: (ToneLayer | {
            from: "normal";
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
        })[];
    };
    /** A switch snapping over: one crisp click with a small knock of body. Switching off knocks upward. */
    toggle: {
        masterGain: number;
        layers: (ToneLayer | {
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            from?: undefined;
        } | {
            from: "normal";
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
        })[];
    };
    /** Air drawing upward with a light note swelling inside it: one breath as a panel opens — menus, drawers, dialogs. */
    open: {
        masterGain: number;
        layers: ({
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            glideTo: number;
            glideTime: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            waveform?: undefined;
            frequency?: undefined;
            from?: undefined;
        } | {
            kind: "tone";
            waveform: "sine";
            frequency: number;
            attack: number;
            decay: number;
            peak: number;
            filterType?: undefined;
            filterFrequency?: undefined;
            glideTo?: undefined;
            glideTime?: undefined;
            filterQ?: undefined;
            from?: undefined;
        } | {
            from: "normal";
            kind: "tone";
            waveform: "sine";
            frequency: number;
            attack: number;
            decay: number;
            peak: number;
            filterType?: undefined;
            filterFrequency?: undefined;
            glideTo?: undefined;
            glideTime?: undefined;
            filterQ?: undefined;
        } | {
            from: "strong";
            kind: "noise";
            filterType: "lowpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            glideTo?: undefined;
            glideTime?: undefined;
            waveform?: undefined;
            frequency?: undefined;
        })[];
    };
    /** The same air falling shut over a low, damped mallet note — closing and dismissing. */
    close: {
        masterGain: number;
        layers: ({
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            glideTo: number;
            glideTime: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            waveform?: undefined;
            frequency?: undefined;
            from?: undefined;
        } | {
            kind: "tone";
            waveform: "sine";
            frequency: number;
            attack: number;
            decay: number;
            peak: number;
            filterType?: undefined;
            filterFrequency?: undefined;
            glideTo?: undefined;
            glideTime?: undefined;
            filterQ?: undefined;
            from?: undefined;
        } | {
            from: "normal";
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            glideTo?: undefined;
            glideTime?: undefined;
            waveform?: undefined;
            frequency?: undefined;
        } | {
            from: "strong";
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            glideTo?: undefined;
            glideTime?: undefined;
            waveform?: undefined;
            frequency?: undefined;
        })[];
    };
    /** One soft mallet chord, C, G and E spread wide so no two notes rub, struck with felt in a small room — confirmed completion. */
    success: {
        masterGain: number;
        layers: (ToneLayer | NoiseLayer)[];
        room: number;
    };
    /** One muted low mallet chord, D with the F a tenth above, spread so it never rubs, short — a calm, recoverable refusal. */
    error: {
        masterGain: number;
        layers: (ToneLayer | NoiseLayer)[];
    };
    /** A soft whoosh whose air rises as it passes — routes, pages, galleries, carousels. */
    navigate: {
        masterGain: number;
        layers: ({
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            glideTo: number;
            glideTime: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            from?: undefined;
        } | {
            from: "normal";
            kind: "noise";
            filterType: "lowpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            glideTo?: undefined;
            glideTime?: undefined;
        } | {
            from: "strong";
            kind: "noise";
            filterType: "lowpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            glideTo?: undefined;
            glideTime?: undefined;
        })[];
    };
    /** One mallet fifth, A and E, neither bright nor low: between success and error. */
    warning: {
        masterGain: number;
        layers: (ToneLayer | NoiseLayer)[];
    };
    /** One low, muted note that swells in and fades away over about a second, never struck: work has begun, nothing has landed. */
    loading: {
        masterGain: number;
        layers: ({
            kind: "tone";
            waveform: "sine";
            frequency: number;
            attack: number;
            decay: number;
            peak: number;
            from?: undefined;
            filterType?: undefined;
            filterFrequency?: undefined;
            filterQ?: undefined;
        } | {
            from: "normal";
            kind: "noise";
            filterType: "lowpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            waveform?: undefined;
            frequency?: undefined;
        } | {
            from: "strong";
            kind: "tone";
            waveform: "sine";
            frequency: number;
            attack: number;
            decay: number;
            peak: number;
            filterType?: undefined;
            filterFrequency?: undefined;
            filterQ?: undefined;
        })[];
    };
    /**
     * One warm glass note, G, below success, in its small room: a result is
     * there. A second mode a hertz sharp lets the glass shimmer once as it
     * rings, too slow to be heard as a wobble.
     */
    ready: {
        masterGain: number;
        layers: (ToneLayer | NoiseLayer)[];
        room: number;
    };
    /**
     * One high glass bell, A and E struck together, ringing longest: blocked
     * until the user answers. The A's twin sits 2 Hz sharp, so the bell swells
     * once rather than warbling.
     */
    attention: {
        masterGain: number;
        layers: (ToneLayer | NoiseLayer)[];
    };
    /**
     * A number rolling to a new value: one breath of air that rises with the
     * count (and falls counting down) over a soft glass note, lasting as long
     * as the roll.
     */
    count: {
        masterGain: number;
        layers: ({
            stretch: true;
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            glideTo: number;
            glideTime: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            waveform?: undefined;
            frequency?: undefined;
            from?: undefined;
        } | {
            stretch: true;
            kind: "tone";
            waveform: "sine";
            frequency: number;
            attack: number;
            decay: number;
            peak: number;
            filterType?: undefined;
            filterFrequency?: undefined;
            glideTo?: undefined;
            glideTime?: undefined;
            filterQ?: undefined;
            from?: undefined;
        } | {
            stretch: true;
            from: "normal";
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            glideTo: number;
            glideTime: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            waveform?: undefined;
            frequency?: undefined;
        } | {
            stretch: true;
            from: "strong";
            kind: "tone";
            waveform: "sine";
            frequency: number;
            attack: number;
            decay: number;
            peak: number;
            filterType?: undefined;
            filterFrequency?: undefined;
            glideTo?: undefined;
            glideTime?: undefined;
            filterQ?: undefined;
        })[];
        vary: {
            pitch: number;
            level: number;
        };
    };
};
export type SoundName = keyof typeof RECIPES;
/** All canonical cue names, derived from the recipe palette. */
export declare const sounds: readonly SoundName[];
/** The v0.2 palette, mapped to the cue that now does each job. Removed in 1.0. */
declare const ALIASES: {
    readonly chime: "success";
    readonly sparkle: "success";
    readonly droplet: "close";
    readonly bloom: "open";
    readonly whisper: "select";
    readonly tick: "select";
    readonly press: "tap";
    readonly release: "tap";
    readonly page: "navigate";
    readonly pulse: "tap";
    readonly scan: "select";
    readonly arrival: "navigate";
};
export type LegacySoundName = keyof typeof ALIASES;
/** Maps a canonical or deprecated name to its canonical cue; anything else is `null`. */
export declare function resolveSound(value: unknown): SoundName | null;
export {};
