/**
 * Observe Module - Signal Population from Unstructured Context
 *
 * Public API for signal population during the Observe phase.
 *
 * @see RFC-002 Section 7
 */

export { executeObservePhase, createObservePhaseExecutor } from './observe-phase.js';
export type { ObservePhaseConfig } from './observe-phase.js';

export { populateSignals, mergeSignalsIntoDecision } from './signal-populator.js';
export type { SignalPopulationResult, SignalPopulationConfig } from './signal-populator.js';
