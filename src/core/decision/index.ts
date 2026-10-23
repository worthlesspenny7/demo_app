/** Decision mode (Phase VIII, MOB-001..032 engine parts). See docs/status/API.md "Decision mode". */
export * from './types.js';
export { DecisionRunner, TIMING_TOLERANCE, PROMPT_MAX_WORDS, CARD_MAX_WORDS, cardWords } from './runner.js';
export { Scheduler, DecisionRun, runResult, playRun, oracleAnswerer, randomAnswerer, dailySeed, RUN_MIN_DECISIONS, RUN_MAX_DECISIONS, MAX_RULE_CARDS, MAX_REPEATS_PER_SKILL, MAX_PER_KIND, BOSS_DECISIONS, microRunner, type SchedulerOptions, type DecisionAnswerer } from './scheduler.js';
export { microScenario, buildMicro, bossScenario, KINDS_OF_SKILL, BOSS_LEG_DECISIONS, type MicroScenario, type MicroHint } from './scenarios.js';
export { Progress, applyRunResult, meterValue, legalUnlocked, bossUnlocked, emptyProgress, dayKey, daysBetween, DECISION_PROGRESS_KEY, METER_GAIN, METER_LOSS, IDLE_GRACE_DAYS, IDLE_DECAY, LEGAL_UNLOCK, BOSS_UNLOCK, FAILING_BELOW, DAILY_RUNS, type StorageLike, type DeskRecorder } from './progress.js';
export { ruleCardFor, ruleCardById, introCardFor, allRuleCards, verdictRule, firstSentence, sentences, FALLBACK_RULES, words } from './rules.js';
export { Navigator, emptyOverrides, ruleClaim, type NavOverrides, type Recovery } from './navigator.js';
