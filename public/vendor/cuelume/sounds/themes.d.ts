/**
 * Themes — finished materials for the same fourteen cues. A theme changes how a
 * cue sounds, never what it means, so every theme carries every cue.
 */
export declare const THEMES: {
    default: {
        tap: {
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
            })[];
            vary: {
                pitch: number;
                level: number;
            };
        };
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
            })[];
        };
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
            })[];
        };
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
        success: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
            room: number;
        };
        error: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
        };
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
        warning: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
        };
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
        ready: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
            room: number;
        };
        attention: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
        };
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
    mech: {
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
        success: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
        };
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
        warning: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
        };
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
        ready: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
        };
        attention: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
        };
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
    bubble: {
        tap: {
            masterGain: number;
            layers: import("./recipes.js").ToneLayer[];
            vary: {
                pitch: number;
                level: number;
            };
        };
        type: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
            vary: {
                pitch: number;
                level: number;
            };
        };
        select: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
            vary: {
                pitch: number;
                level: number;
            };
        };
        toggle: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | {
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
        open: {
            masterGain: number;
            layers: import("./recipes.js").ToneLayer[];
            vary: {
                pitch: number;
                level: number;
            };
        };
        close: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
            vary: {
                pitch: number;
                level: number;
            };
        };
        success: {
            masterGain: number;
            layers: import("./recipes.js").ToneLayer[];
            room: number;
            vary: {
                pitch: number;
                level: number;
            };
        };
        error: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
            vary: {
                pitch: number;
                level: number;
            };
        };
        navigate: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | {
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
        warning: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
            vary: {
                pitch: number;
                level: number;
            };
        };
        loading: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | {
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
        ready: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
            room: number;
            vary: {
                pitch: number;
                level: number;
            };
        };
        attention: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
            vary: {
                pitch: number;
                level: number;
            };
        };
        count: {
            masterGain: number;
            layers: (import("./recipes.js").NoiseLayer | {
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
    press: {
        tap: {
            masterGain: number;
            layers: import("./recipes.js").SoundLayer[];
            vary: {
                pitch: number;
                level: number;
            };
        };
        type: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
            vary: {
                pitch: number;
                level: number;
            };
        };
        select: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
            vary: {
                pitch: number;
                level: number;
            };
        };
        toggle: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
            vary: {
                pitch: number;
                level: number;
            };
        };
        open: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
            vary: {
                pitch: number;
                level: number;
            };
        };
        close: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
            vary: {
                pitch: number;
                level: number;
            };
        };
        success: {
            masterGain: number;
            layers: import("./recipes.js").SoundLayer[];
            room: number;
            vary: {
                pitch: number;
                level: number;
            };
        };
        error: {
            masterGain: number;
            layers: import("./recipes.js").SoundLayer[];
            vary: {
                pitch: number;
                level: number;
            };
        };
        navigate: {
            masterGain: number;
            layers: (import("./recipes.js").ToneLayer | import("./recipes.js").NoiseLayer)[];
            vary: {
                pitch: number;
                level: number;
            };
        };
        warning: {
            masterGain: number;
            layers: import("./recipes.js").SoundLayer[];
            vary: {
                pitch: number;
                level: number;
            };
        };
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
        ready: {
            masterGain: number;
            layers: import("./recipes.js").SoundLayer[];
            room: number;
            vary: {
                pitch: number;
                level: number;
            };
        };
        attention: {
            masterGain: number;
            layers: import("./recipes.js").SoundLayer[];
            vary: {
                pitch: number;
                level: number;
            };
        };
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
};
export type ThemeName = keyof typeof THEMES;
/** The built-in theme names. */
export declare const themes: readonly ThemeName[];
export declare function isThemeName(value: unknown): value is ThemeName;
