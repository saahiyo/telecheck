import { defineComponent, h, onBeforeUnmount, onMounted, onUpdated, ref, watch, } from "vue";
import { leave, morph, reveal, rise } from "./index.js";
import { prepareMorph } from "./morph.js";
const as = (def) => ({ type: [String, Object, Function], default: def });
const element = (value) => {
    const el = value instanceof Element ? value : value?.$el;
    return el instanceof Element ? el : null;
};
/** Rises on mount and leaves before unmount. Use targets="children" for direct children. Renders a div by default. */
export const Rise = defineComponent({
    name: "Rise",
    inheritAttrs: false,
    props: {
        as: as("div"),
        /** Mounted and risen while true; leaves, then unmounts, when it turns false. */
        show: { type: Boolean, default: true },
        targets: String,
        stagger: Number,
        delay: Number,
    },
    setup(props, { attrs, slots }) {
        const el = ref(null);
        const mounted = ref(props.show);
        let previous = null;
        let shown;
        let animations = [];
        let run = 0;
        const sync = () => {
            const current = element(el.value);
            if (previous === current && shown === props.show)
                return;
            if (previous !== current)
                animations.forEach((a) => a.cancel());
            previous = current;
            shown = props.show;
            const mine = ++run;
            if (!current)
                return;
            if (props.show) {
                animations = rise(current, { targets: props.targets, stagger: props.stagger, delay: props.delay });
            }
            else {
                animations = leave(current, { targets: props.targets });
                Promise.all(animations.map((a) => a.finished))
                    .then(() => { if (mine === run)
                    mounted.value = false; })
                    .catch(() => { });
            }
        };
        watch(() => props.show, (show) => { if (show)
            mounted.value = true; });
        onMounted(sync);
        onUpdated(sync);
        onBeforeUnmount(() => {
            ++run;
            animations.forEach((a) => a.cancel());
        });
        return () => (mounted.value ? h(props.as, { ...attrs, ref: el }, typeof props.as === "string" ? slots.default?.() : slots) : null);
    },
});
// The active face sits in the flow and sizes the wrapper; the inactive one floats over it.
const wrap = { position: "relative", display: "inline-flex", alignItems: "center" };
// A constant CSS string is patched only once. Object styles are reapplied by Vue on
// every render and would overwrite the positions and opacity owned by morph().
const face = (shown) => `display:inline-flex;align-items:center;white-space:nowrap;will-change:opacity,filter,scale${shown ? ";position:relative" : ";position:absolute;inset:0;opacity:0"}`;
/** Two stacked faces. Shows `on` when active, `off` otherwise, morphing between them. Faces come from props or the `off` and `on` slots. */
export const Morph = defineComponent({
    name: "Morph",
    inheritAttrs: false,
    props: {
        as: as("span"),
        active: { type: Boolean, required: true },
        off: String,
        on: String,
    },
    setup(props, { attrs, slots }) {
        const a = ref(null);
        const b = ref(null);
        const shownAtMount = props.active;
        const offStyle = face(!shownAtMount);
        const onStyle = face(shownAtMount);
        let previous;
        let animations = [];
        const sync = () => {
            if (!a.value || !b.value)
                return;
            const replaced = previous?.off !== a.value || previous?.on !== b.value;
            if (!replaced && previous?.active === props.active)
                return;
            const outgoing = props.active ? a.value : b.value;
            const incoming = props.active ? b.value : a.value;
            if (replaced) {
                animations.forEach((a) => a.cancel());
                prepareMorph(outgoing, incoming);
                animations = [];
            }
            else
                animations = morph(outgoing, incoming);
            previous = { off: a.value, on: b.value, active: props.active };
        };
        onMounted(sync);
        onUpdated(sync);
        onBeforeUnmount(() => animations.forEach((a) => a.cancel()));
        const faces = () => [
            h("span", { ref: a, style: offStyle, "aria-hidden": shownAtMount, inert: shownAtMount }, slots.off?.() ?? props.off),
            h("span", { ref: b, style: onStyle, "aria-hidden": !shownAtMount, inert: !shownAtMount }, slots.on?.() ?? props.on),
        ];
        return () => h(props.as, { ...attrs, style: [wrap, attrs.style] }, typeof props.as === "string" ? faces() : { default: faces });
    },
});
/** Reveals as it scrolls into view. Use targets="children" for direct children. Renders a div by default. */
export const Reveal = defineComponent({
    name: "Reveal",
    inheritAttrs: false,
    props: {
        as: as("div"),
        targets: String,
        stagger: Number,
        root: Object,
    },
    setup(props, { attrs, slots }) {
        const el = ref(null);
        let previous = null;
        let stop = () => { };
        const sync = () => {
            const current = element(el.value);
            if (current === previous)
                return;
            stop();
            previous = current;
            stop = current ? reveal(current, { targets: props.targets, stagger: props.stagger, root: props.root }) : () => { };
        };
        onMounted(sync);
        onUpdated(sync);
        onBeforeUnmount(() => stop());
        return () => h(props.as, { ...attrs, ref: el }, typeof props.as === "string" ? slots.default?.() : slots);
    },
});
