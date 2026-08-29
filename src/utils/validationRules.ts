export type ComparisonOperator = '==' | '!=' | '<' | '<=' | '>' | '>='

export const COMPARISON_OPERATOR_LABELS: Record<ComparisonOperator, string> = {
  '==': 'Equal to (==)',
  '<=': 'Less than or equal to (<=)',
  '>=': 'Greater than or equal to (>=)',
  '<': 'Less than (<)',
  '>': 'Greater than (>)',
  '!=': 'Not equal to (!=)',
}

export const COMPARISON_OPERATOR_SYMBOLS: Record<ComparisonOperator, string> = {
  '==': '==',
  '<=': '<=',
  '>=': '>=',
  '<': '<',
  '>': '>',
  '!=': '!=',
}

export type OperandKind = 'sum' | 'field' | 'constant'

export type RuleOperand = {
  kind: OperandKind
  fieldIds?: number[]
  fieldId?: number
  value?: number
}

export type TemplateValidationRule = {
  id?: string
  name?: string
  type?: 'comparison' | 'sum_equals' | 'sum' | 'compare'
  operator?: ComparisonOperator
  left?: RuleOperand
  right?: RuleOperand
  message?: string
  // Legacy backward-compatibility for sum_equals
  fieldIds?: number[]
  equals?: number
}

const EPSILON = 0.001

function evaluateComparison(left: number, op: ComparisonOperator, right: number): boolean {
  switch (op) {
    case '==':
      return Math.abs(left - right) <= EPSILON
    case '!=':
      return Math.abs(left - right) > EPSILON
    case '<':
      return left < right - EPSILON
    case '<=':
      return left <= right + EPSILON
    case '>':
      return left > right + EPSILON
    case '>=':
      return left >= right - EPSILON
    default:
      return true
  }
}

function resolveOperand(
  operand: RuleOperand | undefined,
  values: Record<number, string | boolean | number | null | undefined>,
  namesById: Map<number, string>,
): { val: number; label: string } {
  if (!operand) return { val: 0, label: '0' }

  if (operand.kind === 'sum') {
    const ids = operand.fieldIds ?? []
    let sum = 0
    const parts: string[] = []
    for (const id of ids) {
      parts.push(namesById.get(id) ?? `#${id}`)
      const raw = values[id]
      const n = typeof raw === 'number' ? raw : Number(raw ?? 0)
      sum += Number.isFinite(n) ? n : 0
    }
    const val = Math.round(sum * 1000) / 1000
    return { val, label: parts.join(' + ') || '0' }
  }

  if (operand.kind === 'field') {
    const id = operand.fieldId ?? 0
    const raw = values[id]
    const n = typeof raw === 'number' ? raw : Number(raw ?? 0)
    const val = Number.isFinite(n) ? n : 0
    return { val, label: namesById.get(id) ?? `#${id}` }
  }

  const val = Number(operand.value ?? 0)
  return { val, label: String(val) }
}

/** Describes a rule in plain text for UI badges and previews. */
export function describeRule(
  rule: TemplateValidationRule,
  fields: { id: number; fieldName: string }[],
): string {
  const namesById = new Map(fields.map(f => [f.id, f.fieldName]))

  // Legacy format support
  if (rule.type === 'sum_equals' || (!rule.left && rule.fieldIds)) {
    const ids = rule.fieldIds ?? []
    const labels = ids.map(id => namesById.get(id) ?? `#${id}`).join(' + ')
    return `${labels || '(Empty sum)'} == ${rule.equals ?? 100}`
  }

  const op = rule.operator ?? '=='
  const left = resolveOperand(rule.left, {}, namesById).label
  const right = resolveOperand(rule.right, {}, namesById).label
  return `${left} ${op} ${right}`
}

/** Build a human-readable error if any validation rule fails. Returns null when all rules pass. */
export function checkValidationRules(
  rules: TemplateValidationRule[] | null | undefined,
  fields: { id: number; fieldName: string; fieldType?: string }[],
  values: Record<number, string | boolean | number | null | undefined>,
): string | null {
  if (!rules?.length) return null
  const namesById = new Map(fields.map(f => [f.id, f.fieldName]))

  for (const rule of rules) {
    // 1. Legacy sum_equals format
    if (rule.type === 'sum_equals' || (!rule.left && rule.fieldIds)) {
      const ids = rule.fieldIds ?? []
      if (!ids.length) continue
      let sum = 0
      for (const id of ids) {
        const raw = values[id]
        const n = typeof raw === 'number' ? raw : Number(raw ?? 0)
        sum += Number.isFinite(n) ? n : 0
      }
      sum = Math.round(sum * 1000) / 1000
      const target = Number(rule.equals ?? 100)
      if (Math.abs(sum - target) > EPSILON) {
        const labels = ids.map(id => namesById.get(id) ?? `#${id}`).join(' + ')
        return rule.message?.trim() || `${labels} must equal ${target} (currently ${sum})`
      }
      continue
    }

    // 2. Generic rule format
    const op = rule.operator ?? '=='
    const left = resolveOperand(rule.left, values, namesById)
    const right = resolveOperand(rule.right, values, namesById)

    const passed = evaluateComparison(left.val, op, right.val)
    if (!passed) {
      if (rule.message?.trim()) return rule.message.trim()
      return `Condition failed: ${left.label} (${left.val}) must be ${op} ${right.label} (${right.val})`
    }
  }

  return null
}
