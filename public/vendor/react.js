"use client";
import { createElement, forwardRef, useEffect, useMemo, useRef, useState, version, } from "react";
import { leave, morph, reveal, rise } from "./index.js";
import { prepareMorph } from "./morph.js";
const cancel = (animations) => animations.forEach((animation) => animation.cancel());
// Hooks: the escape hatch when you already own the element.
/** Returns a ref. The element rises on attachment; use targets="children" for its direct children. */
export function useRise(options) {
    const ref = useRef(null);
    const previous = useRef(null);
    const animations = useRef([]);
    useEffect(() => {
        if (previous.current === ref.current)
            return;
        cancel(animations.current);
        previous.current = ref.current;
        animations.current = ref.current ? rise(ref.current, options) : [];
    });
    useEffect(() => () => {
        cancel(animations.current);
        previous.current = null;
    }, []);
    return ref;
}
/** Returns [off, on] refs. `on` shows when active. Morphs on change, settles without motion on mount. */
export function useMorph(active) {
    const off = useRef(null);
    const on = useRef(null);
    const previous = useRef(null);
    const animations = useRef([]);
    useEffect(() => {
        const replaced = previous.current?.off !== off.current || previous.current?.on !== on.current;
        if (replaced) {
            cancel(animations.current);
            previous.current = null;
        }
        if (!off.current || !on.current)
            return;
        if (previous.current?.active === active)
            return;
        const outgoing = active ? off.current : on.current;
        const incoming = active ? on.current : off.current;
        if (!previous.current) {
            prepareMorph(outgoing, incoming);
            animations.current = [];
        }
        else
            animations.current = morph(outgoing, incoming);
        previous.current = { off: off.current, on: on.current, active };
    });
    useEffect(() => () => {
        cancel(animations.current);
        previous.current = null;
    }, []);
    return [off, on];
}
/** Returns a ref. The element reveals as it scrolls into view; use targets="children" for its direct children. */
export function useReveal(options) {
    const ref = useRef(null);
    const previous = useRef(null);
    const stop = useRef(undefined);
    useEffect(() => {
        if (previous.current === ref.current)
            return;
        stop.current?.();
        previous.current = ref.current;
        stop.current = ref.current ? reveal(ref.current, options) : undefined;
    });
    useEffect(() => () => {
        stop.current?.();
        previous.current = null;
    }, []);
    return ref;
}
const useMergedRef = (own, theirs) => useMemo(() => {
    let cleanup;
    return (el) => {
        own.current = el;
        if (typeof theirs === "function") {
            if (el)
                cleanup = theirs(el);
            else if (typeof cleanup === "function") {
                cleanup();
                cleanup = undefined;
            }
            else
                theirs(null);
        }
        else if (theirs)
            theirs.current = el;
    };
}, [own, theirs]);
/** Rises on mount and leaves before unmount. Use targets="children" for direct children. Renders a div by default. */
export const Rise = forwardRef(({ as = "div", show = true, targets, stagger, delay, ...rest }, ref) => {
    const el = useRef(null);
    const mergedRef = useMergedRef(el, ref);
    const previous = useRef(null);
    const animations = useRef([]);
    const run = useRef(0);
    const [mounted, setMounted] = useState(show);
    if (show && !mounted)
        setMounted(true);
    useEffect(() => {
        if (previous.current?.el === el.current && previous.current.show === show)
            return;
        if (previous.current?.el !== el.current)
            cancel(animations.current);
        previous.current = { el: el.current, show };
        const mine = ++run.current;
        if (!el.current)
            return;
        if (show) {
            animations.current = rise(el.current, { targets, stagger, delay });
            return;
        }
        animations.current = leave(el.current, { targets });
        Promise.all(animations.current.map((a) => a.finished))
            .then(() => mine === run.current && setMounted(false))
            .catch(() => { });
    });
    useEffect(() => () => {
        ++run.current;
        cancel(animations.current);
        previous.current = null;
    }, []);
    return mounted ? createElement(as, { ...rest, ref: mergedRef }) : null;
});
// The active face sits in the flow and sizes the wrapper; the inactive one floats over it.
const wrap = { position: "relative", display: "inline-flex", alignItems: "center" };
const face = (shown) => ({
    display: "inline-flex",
    alignItems: "center",
    whiteSpace: "nowrap",
    willChange: "opacity, filter, scale",
    ...(shown ? { position: "relative" } : { position: "absolute", inset: 0, opacity: 0 }),
});
// React 18 forwards inert as an unknown attribute; React 19 knows it is boolean.
const inert = version.startsWith("18.") ? "" : true;
/** Two stacked faces. Shows `on` when active, `off` otherwise, morphing between them. */
export const Morph = forwardRef(({ as = "span", active, off, on, style, ...rest }, ref) => {
    const [a, b] = useMorph(active);
    const [shownAtMount] = useState(active);
    return createElement(as, { ...rest, ref, style: { ...wrap, ...style } }, createElement("span", { ref: a, style: face(!shownAtMount), "aria-hidden": shownAtMount, inert: shownAtMount ? inert : undefined }, off), createElement("span", { ref: b, style: face(shownAtMount), "aria-hidden": !shownAtMount, inert: shownAtMount ? undefined : inert }, on));
});
/** Reveals as it scrolls into view. Use targets="children" for direct children. Renders a div by default. */
export const Reveal = forwardRef(({ as = "div", targets, stagger, root, ...rest }, ref) => createElement(as, { ...rest, ref: useMergedRef(useReveal({ targets, stagger, root }), ref) }));
