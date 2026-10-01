/** Internal adapter helper: establish the selected face without a mount animation. */
export declare function prepareMorph(outgoing: Element, incoming: Element): void;
/**
 * Morph one face into another. Text faces diff per grapheme: shared leading letters
 * stay still, the rest blur out and in, staggered. Other faces crossfade. The parent
 * follows the incoming width. Interrupted faces retarget from their current pixels.
 */
export declare function morph(outgoing: Element, incoming: Element): Animation[];
