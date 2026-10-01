import { calm, current, moving } from "./dom.js";
import { morph as morphFaces, reveal as observe } from "./index.js";
import { prepareMorph } from "./morph.js";
import { EASE_POINTS, LIFT_PX, MS, STAGGER } from "./tokens.js";
// Svelte owns enter and exit through `in:` and `out:`, so rise and leave are transitions and
// the framework waits for the exit before removing the node. morph and reveal are actions.
// The one curve, evaluated in JS because Svelte samples css transitions itself.
const bezier = ([x1, y1, x2, y2]) => {
    const at = (t, a1, a2) => ((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t * t + 3 * a1 * t;
    const slope = (t, a1, a2) => 3 * (1 - 3 * a2 + 3 * a1) * t * t + 2 * (3 * a2 - 6 * a1) * t + 3 * a1;
    return (x) => {
        let t = x;
        for (let i = 0; i < 8; i++) {
            const s = slope(t, x1, x2);
            if (!s)
                break;
            t -= (at(t, x1, x2) - x) / s;
        }
        return at(t, y1, y2);
    };
};
const easing = bezier(EASE_POINTS);
const fade = (node, entering) => {
    const still = calm();
    const interrupted = moving(node);
    const from = interrupted ? current(node, ["opacity", "translate"]) : null;
    const opacity = from ? Number(from.opacity) : entering ? 0 : 1;
    const translate = String(from?.translate ?? "none").split(/\s+/);
    const x = translate[0] === "none" ? "0px" : translate[0];
    const y = translate[1] ?? "0px";
    return (t, u) => {
        const alpha = entering ? opacity + (1 - opacity) * t : opacity * t;
        if (still)
            return `opacity:${alpha}`;
        if (!interrupted)
            return `opacity:${alpha};translate:0 ${LIFT_PX * u}px`;
        const remaining = entering ? u : t;
        const drop = entering ? 0 : LIFT_PX * u;
        return `opacity:${alpha};translate:calc(${x} * ${remaining}) calc(${y} * ${remaining} + ${drop}px)`;
    };
};
/** `in:rise` fades and lifts the element in. Use `index` on list items to stagger them. */
export function rise(node, { delay = 0, index = 0 } = {}) {
    // Svelte may reuse this config after an interrupted transition. Sample anew
    // whenever its animation manager reads css, rather than retaining the first run.
    return { delay: delay + index * STAGGER.rise, duration: MS.enter, easing, get css() { return fade(node, true); } };
}
/** `out:leave` fades and drops the element out. Svelte removes the node when it finishes. */
export function leave(node, { delay = 0, index = 0 } = {}) {
    return { delay: delay + index * STAGGER.leave, duration: MS.leave, easing, get css() { return fade(node, false); } };
}
// The active face sits in the flow and sizes the node; the inactive one floats over it.
const face = (el, shown) => {
    el.style.cssText += `;display:inline-flex;align-items:center;white-space:nowrap;will-change:opacity,filter,scale${shown ? ";position:relative;inset:auto;opacity:1" : ";position:absolute;inset:0;opacity:0"}`;
    el.setAttribute("aria-hidden", String(!shown));
    el.toggleAttribute("inert", !shown);
};
/** `use:morph={active}` on an element whose two children are the off and on faces. */
export const morph = (node, active) => {
    const off = node.children[0];
    const on = node.children[1];
    if (!off || !on || node.children.length !== 2)
        throw new Error("cube-motion: morph needs exactly two child faces.");
    node.style.cssText += ";position:relative;display:inline-flex;align-items:center";
    face(off, !active);
    face(on, active);
    prepareMorph(active ? off : on, active ? on : off);
    let animations = [];
    return {
        update(next) {
            if (next === active)
                return;
            active = next;
            animations = morphFaces(active ? off : on, active ? on : off);
        },
        destroy() {
            animations.forEach((animation) => animation.cancel());
        },
    };
};
/** `use:reveal` observes the element; set targets: "children" to reveal its children. */
export const reveal = (node, options) => {
    let stop = observe(node, options);
    return {
        update(next) {
            stop();
            stop = observe(node, next);
        },
        destroy() { stop(); },
    };
};
