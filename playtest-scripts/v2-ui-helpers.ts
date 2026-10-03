import { OracleBot } from '../src/agent/bots.js';
import type { Simulator } from '../src/core/sim.js';
export type OracleBotLike = OracleBot;
export function makeBot(sim: Simulator): OracleBot { return new OracleBot(sim, { useWatch: true }); }
