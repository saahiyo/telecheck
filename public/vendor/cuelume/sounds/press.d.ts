/**
 * The `press` theme: the same fourteen cues, each one press of a premium
 * switch. A press clicks (a tight ring over a softer body, gone in about 5 ms)
 * over the knock of what it moves. Modelled on the trackpad and keycaps in
 * DawoodUI's Artasaka preview.
 *
 * The interaction cues vary the one press by what it moves: which click
 * (pressing in, or the lighter one letting go), how low and how damped the
 * body is, and a breath of air when something lifts, slides or shuts.
 *
 * Outcomes are not touched, so they do not click: they are tap's warm note on
 * its own, swelling in, with a chord that says what happened. Success is
 * major and rings into a small room, error a low, spread minor over a soft
 * thump, warning a plain fifth between them, attention a high bell, and
 * loading one soft, low note that swells in and fades. Levels match the
 * default palette on the loudest 30 ms.
 *
 * Arranged for emphasis like the other themes: layers marked from "normal"
 * are ornament that subtle leaves out, and each cue has a layer only strong
 * plays.
 */
import { type NoiseLayer, type SoundLayer, type ToneLayer } from "./recipes.js";
export declare const PRESS: {
    /** One press and the pad's deep note under it: the model every other cue varies. */
    tap: {
        masterGain: number;
        layers: SoundLayer[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** The press alone over a short knock: a keycap bottoming out. */
    type: {
        masterGain: number;
        layers: (ToneLayer | NoiseLayer)[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** A detent: only the light click of letting go, over a small, high knock. A later option knocks higher, an earlier one lower. */
    select: {
        masterGain: number;
        layers: (ToneLayer | NoiseLayer)[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** A switch thrown: the press and a firm mid knock, with the snap of the other contact. Switching off knocks upward. */
    toggle: {
        masterGain: number;
        layers: (ToneLayer | NoiseLayer)[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** A latch letting go: the light click, a knock, and air drawn upward as the part lifts. */
    open: {
        masterGain: number;
        layers: (ToneLayer | NoiseLayer)[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** A lid shutting: a lower, duller click, air pushed out and down, and a low knock as it seats. */
    close: {
        masterGain: number;
        layers: (ToneLayer | NoiseLayer)[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** No click: a C major chord spread wide, C, G and E, swelling in and ringing into a small room. */
    success: {
        masterGain: number;
        layers: SoundLayer[];
        room: number;
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** No click: a low A with the C an octave and a third above, minor and spread so its overtones never rub, over a soft thump. A calm refusal. */
    error: {
        masterGain: number;
        layers: SoundLayer[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** A swipe: the light click with air sliding past it. Going back, the air falls. */
    navigate: {
        masterGain: number;
        layers: (ToneLayer | NoiseLayer)[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** No click: a plain fifth, A and E, between success and error. Heads up, nothing broke. */
    warning: {
        masterGain: number;
        layers: SoundLayer[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** No click: one warm, low G that swells in softly and fades within about a second. Work has begun. */
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
        } | {
            from: "normal";
            kind: "tone";
            waveform: "sine";
            frequency: number;
            attack: number;
            decay: number;
            peak: number;
        } | {
            from: "strong";
            kind: "tone";
            waveform: "sine";
            frequency: number;
            attack: number;
            decay: number;
            peak: number;
        })[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** No click: one long, warm G below success, ringing into a small room. A result is there. */
    ready: {
        masterGain: number;
        layers: SoundLayer[];
        room: number;
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** No click: A and E over A, high and bell-like, ringing longest. Blocked until the user answers. */
    attention: {
        masterGain: number;
        layers: SoundLayer[];
        vary: {
            pitch: number;
            level: number;
        };
    };
    /** A number rolling: a dial spun, air rising with it for as long as the roll (falling counting down). */
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
            from?: undefined;
        } | {
            stretch: true;
            kind: "noise";
            filterType: "lowpass";
            filterFrequency: number;
            glideTo: number;
            glideTime: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
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
        } | {
            stretch: true;
            from: "strong";
            kind: "noise";
            filterType: "lowpass";
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
};
