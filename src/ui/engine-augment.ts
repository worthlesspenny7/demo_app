/**
 * Type augmentation for engine fields the UI reads but that the engine's `Observation` interface does not declare yet
 * (the engine returns `stoppedAtLine` from observe(); see docs/status/UI-REQUESTS.md). Interface merging with an identical
 * property type stays valid after the engine adds the field itself.
 */
declare module '../core/sim.js' {
  interface Observation {
    /** Line number of the instruction at the node the car is waiting at (stopped), else null. */
    stoppedAtLine: number | null;
  }
}
export {};
