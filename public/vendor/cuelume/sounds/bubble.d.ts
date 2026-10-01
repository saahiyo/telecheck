/**
 * The `bubble` theme: the same fourteen cues, made of water. Playful and
 * opt-in: an app switches to it with `setTheme`, or uses it for one moment with
 * `play()`'s `theme` option or `data-cuelume-theme`.
 *
 * Every cue is its own gesture, and one sound: a knock for tap and type, a drip
 * for select, a cork for toggle, a balloon for open, a gulp for close, and so
 * on. The only theme whose tones slide. Nothing
 * is centred above 5 kHz, outcomes say what they mean in one glide (success rises,
 * error sinks, warning stays level, attention bends up), and levels match the
 * default palette on the loudest 30 ms.
 *
 * Arranged for emphasis like the other themes: layers marked from "normal"
 * are ornament that subtle leaves out, and each cue has a layer only strong
 * plays.
 */
import { type NoiseLayer, type ToneLayer } from "./recipes.js";
export declare const BUBBLE: {
    /** A keycap landing on water: a soft knock that blooms into a small bubble. A little different every time. */
    tap: {
        masterGain: number;
        layers: ToneLayer[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** A keycap popping up: a higher, shorter knock, pitched differently every stroke. */
    type: {
        masterGain: number;
        layers: (ToneLayer | NoiseLayer)[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** A drip: the only quick flick upward. A later option drips higher, an earlier one lower. */
    select: {
        masterGain: number;
        layers: (ToneLayer | NoiseLayer)[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** A cork: a soft thup as the air rushes up an octave. Switching off sinks it. */
    toggle: {
        masterGain: number;
        layers: (ToneLayer | {
            kind: "noise";
            filterType: "lowpass";
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
    /** A balloon filling: one slow swell that rises a ninth. */
    open: {
        masterGain: number;
        layers: ToneLayer[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** A gulp: one fast fall. */
    close: {
        masterGain: number;
        layers: (ToneLayer | NoiseLayer)[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** One bubble rising a fifth, C to G, in a small room. */
    success: {
        masterGain: number;
        layers: ToneLayer[];
        room: number;
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** One bubble sinking a fourth, F to C: a soft "uh-oh". */
    error: {
        masterGain: number;
        layers: (ToneLayer | NoiseLayer)[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** A zip: one bubble shooting up through fizz. Going back, it dives. */
    navigate: {
        masterGain: number;
        layers: (ToneLayer | {
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
        })[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** One round note with a small wobble, settling where it started: level. */
    warning: {
        masterGain: number;
        layers: (ToneLayer | NoiseLayer)[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** A simmer: one slow bubble rising through soft fizz, gone within about a second. Nothing lands. */
    loading: {
        masterGain: number;
        layers: (ToneLayer | {
            kind: "noise";
            filterType: "lowpass";
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
            filterType: "lowpass";
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
    /** A drop into water: the plip and the round bubble it leaves, one sound, in a small room. */
    ready: {
        masterGain: number;
        layers: (ToneLayer | NoiseLayer)[];
        room: number;
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** "Hm?": one note that bends up a fourth like a question. */
    attention: {
        masterGain: number;
        layers: (ToneLayer | NoiseLayer)[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** A number rolling: fizz and one bubble rising together for as long as the roll (sinking counting down). */
    count: {
        masterGain: number;
        layers: (NoiseLayer | {
            stretch: true;
            offset?: number;
            attack: number;
            decay: number;
            peak: number;
            glideTo?: number;
            glideTime?: number;
            from?: "normal" | "strong";
            kind: "tone";
            waveform: OscillatorType;
            frequency: number;
            detune?: number;
        })[];
        vary: {
            pitch: number;
            level: number;
        };
    };
};
