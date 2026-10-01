/**
 * The `mech` theme: the same fourteen cues in a dry, precise, mechanical
 * material. Machined parts rather than glass, wood, and air. No room, no
 * ring beyond a struck part's own, and nothing harsh, industrial,
 * retro-computer, or sci-fi.
 *
 * Level-matched to the default palette on momentary loudness (the loudest
 * 30 ms), so switching themes changes the material, not the volume.
 *
 * Arranged for emphasis like the default palette: layers marked from
 * "normal" are ornament that subtle leaves out, and each cue has a layer only
 * strong plays.
 */
export declare const MECH: {
    /** A machined click, like a camera's shutter button, over the short knock of its housing. */
    tap: {
        masterGain: number;
        layers: (import("./recipes.js").ToneLayer | {
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
    /** A tight low-profile switch: shorter and drier than a keycap, almost no body. */
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
    /** A ratchet detent: a precision dial clicking over one tooth, with a faint ring of the metal. */
    select: {
        masterGain: number;
        layers: (import("./recipes.js").ToneLayer | {
            from: "normal";
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
        } | {
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            from?: undefined;
        })[];
    };
    /** A toggle switch's throw: the lever snaps over centre with the knock of its housing. */
    toggle: {
        masterGain: number;
        layers: (import("./recipes.js").ToneLayer | {
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
    };
    /** A latch releasing: the catch lets go as the bolt slides back, in one motion. */
    open: {
        masterGain: number;
        layers: ({
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            glideTo?: undefined;
            glideTime?: undefined;
            from?: undefined;
        } | {
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
            filterType: "bandpass";
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
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            glideTo?: undefined;
            glideTime?: undefined;
        })[];
    };
    /** A latch catching: the bolt slides home into the catch, in one motion. */
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
            from?: undefined;
        } | {
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            glideTo?: undefined;
            glideTime?: undefined;
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
        })[];
    };
    /** One dry struck bar, F, C and A at once, spread so no two notes rub, hit with something hard: a short chord, not a bell. */
    success: {
        masterGain: number;
        layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
    };
    /** One firm low knock with a dull D in it and the F a tenth above, like a handle that is locked. */
    error: {
        masterGain: number;
        layers: (import("./recipes.js").ToneLayer | {
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
    };
    /** A short carriage slide, rising as it passes. */
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
            filterType: "bandpass";
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
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            glideTo?: undefined;
            glideTime?: undefined;
        })[];
    };
    /** One dry struck fifth, D and A: between success and error. */
    warning: {
        masterGain: number;
        layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
    };
    /** A small motor spinning up and winding down: one soft, low whirr over about a second. */
    loading: {
        masterGain: number;
        layers: ({
            kind: "noise";
            filterType: "bandpass";
            filterFrequency: number;
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
            waveform?: undefined;
            frequency?: undefined;
        } | {
            from: "strong";
            kind: "noise";
            filterType: "lowpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            waveform?: undefined;
            frequency?: undefined;
        })[];
    };
    /** One dry struck bar, lower than success: a result is there. */
    ready: {
        masterGain: number;
        layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
    };
    /** One metal bell, A and E struck together, ringing longer than the rest. */
    attention: {
        masterGain: number;
        layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
    };
    /** An odometer drum turning: one dry slide that rises with the count and lasts as long as the roll. */
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
            filterType: "bandpass";
            filterFrequency: number;
            filterQ: number;
            attack: number;
            decay: number;
            peak: number;
            glideTo?: undefined;
            glideTime?: undefined;
        })[];
        vary: {
            pitch: number;
            level: number;
        };
    };
};
