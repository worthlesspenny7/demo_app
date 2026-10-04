/**
 * CAMEO intersection diagram (UI-004, GRIID-015): the renderer lives in src/core/cameo.ts (one renderer for the book, the trap cards and the references);
 * this module re-exports it for the UI.
 */
export { cameoSvg, cameoOfNode, pickRouteExit, signGlyph, signFace, mixedCase, wrapWords, landmarkCaption, bandFor, CAMEO_W, CAMEO_H } from '../../core/cameo.js';
export type { CameoExit, CameoOptions, CameoSignSpec, SignFace } from '../../core/cameo.js';
