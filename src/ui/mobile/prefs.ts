/** Phone-only preferences (MOB-024): the driver's voice is off by default on the phone. */
const SPEECH_KEY = 'rally-trainer.mobile.speech.v1';
let mem = false;
export function speechOn(): boolean { try { return localStorage.getItem(SPEECH_KEY) === '1'; } catch { return mem; } }
export function setSpeech(on: boolean): void { mem = on; try { localStorage.setItem(SPEECH_KEY, on ? '1' : '0'); } catch { /* ignore */ } }
