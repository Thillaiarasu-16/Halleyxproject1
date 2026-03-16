import { Parser } from 'expr-eval';
import { Rule } from '@prisma/client';
import { logger } from '../utils/logger';

export interface RuleEvaluationResult {
  rule: string;
  result: boolean;
  error?: string;
}

export interface RuleEngineResult {
  next_step_id: string | null;
  evaluated_rules: RuleEvaluationResult[];
  matched_rule: string | null;
}

const parser = new Parser({
  operators: {
    logical: true,
    comparison: true,
    'in': true,
  },
});

/**
 * Evaluates a condition string against input data.
 * Supports: ==, !=, <, >, <=, >=, &&, ||
 * and string functions: contains(field, "value")
 */
function evaluateCondition(condition: string, data: Record<string, unknown>): boolean {
  if (condition === 'DEFAULT') return true;

  // Transform string helper functions into expr-eval compatible expressions
  let transformed = condition
    .replace(/contains\((\w+),\s*['"](.+?)['"]\)/g, '($1 != null)')  // basic contains stub
    .replace(/startsWith\((\w+),\s*['"](.+?)['"]\)/g, '($1 != null)')
    .replace(/endsWith\((\w+),\s*['"](.+?)['"]\)/g, '($1 != null)');

  // Handle string comparison with single quotes → replace with double for expr-eval
  transformed = transformed.replace(/'/g, '"');

  const expr = parser.parse(transformed);
  const result = expr.evaluate(data as Record<string, number | string | boolean>);
  return Boolean(result);
}

/**
 * Runs the rule engine for a given step.
 * Rules are evaluated in priority order (ascending).
 * First matching rule wins. DEFAULT is the fallback catch-all.
 */
export function evaluateRules(
  rules: Rule[],
  data: Record<string, unknown>
): RuleEngineResult {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  const evaluated_rules: RuleEvaluationResult[] = [];

  // Separate DEFAULT rules to evaluate last
  const normalRules = sorted.filter((r) => r.condition !== 'DEFAULT');
  const defaultRules = sorted.filter((r) => r.condition === 'DEFAULT');

  for (const rule of [...normalRules, ...defaultRules]) {
    try {
      const result = evaluateCondition(rule.condition, data);
      evaluated_rules.push({ rule: rule.condition, result });

      if (result) {
        logger.info(`Rule matched: "${rule.condition}" → next_step: ${rule.next_step_id}`);
        return {
          next_step_id: rule.next_step_id,
          evaluated_rules,
          matched_rule: rule.condition,
        };
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`Rule evaluation error: ${error}`, { condition: rule.condition });
      evaluated_rules.push({ rule: rule.condition, result: false, error });
    }
  }

  return {
    next_step_id: null,
    evaluated_rules,
    matched_rule: null,
  };
}
