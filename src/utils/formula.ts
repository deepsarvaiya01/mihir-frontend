interface FormulaFrame { result: number; pendingOp: string | null; isFirst: boolean }

export interface FormulaStep { fieldId?: number; op?: string; value?: number; paren?: '(' | ')' }

/** Parses a stored formula: `{ common }` for a plain steps array, `{ male, female }` for a gendered one. */
export function parseFormula(optionsJson: string | null): { common?: FormulaStep[]; male?: FormulaStep[]; female?: FormulaStep[] } {
  if (!optionsJson) return {}
  try {
    const parsed = JSON.parse(optionsJson)
    if (Array.isArray(parsed)) return { common: parsed }
    if (parsed && typeof parsed === 'object') return { male: parsed.male ?? [], female: parsed.female ?? [] }
  } catch { /* malformed JSON — treat as no formula */ }
  return {}
}

/** Every field a calculated field's formula reads (from both the male and female formulas when gendered). */
export function formulaFieldIds(optionsJson: string | null): number[] {
  const f = parseFormula(optionsJson)
  const steps = [...(f.common ?? []), ...(f.male ?? []), ...(f.female ?? [])]
  return Array.from(new Set(steps.filter(s => s.fieldId !== undefined).map(s => s.fieldId!)))
}

/** Picks the steps to evaluate for a patient's gender — male formula is the fallback when gender is unknown. */
export function resolveFormulaSteps(optionsJson: string | null, gender?: string | null): FormulaStep[] {
  const f = parseFormula(optionsJson)
  if (f.common) return f.common
  return (gender === 'Female' ? f.female : f.male) ?? []
}

/** Evaluates a stored calculated-field formula (steps with optional paren grouping and a %-of operator). */
export function evalFormula(optionsJson: string | null, values: Record<number, string | boolean>, gender?: string | null): number {
  if (!optionsJson) return 0
  try {
    const steps = resolveFormulaSteps(optionsJson, gender)
    const stack: FormulaFrame[] = [{ result: 0, pendingOp: null, isFirst: true }]

    const applyOp = (frame: FormulaFrame, val: number) => {
      if (frame.isFirst) { frame.result = val; frame.isFirst = false; return }
      if (frame.pendingOp === '+') frame.result += val
      else if (frame.pendingOp === '-') frame.result -= val
      else if (frame.pendingOp === '*') frame.result *= val
      else if (frame.pendingOp === '/') frame.result = val !== 0 ? frame.result / val : 0
      else if (frame.pendingOp === '%') frame.result = (frame.result * val) / 100
      frame.pendingOp = null
    }

    for (const step of steps) {
      if (step.paren === '(') {
        stack.push({ result: 0, pendingOp: null, isFirst: true })
      } else if (step.paren === ')') {
        const finished = stack.pop()!
        applyOp(stack[stack.length - 1], finished.isFirst ? 0 : finished.result)
      } else if ('fieldId' in step && step.fieldId !== undefined) {
        applyOp(stack[stack.length - 1], Number(values[step.fieldId] ?? 0) || 0)
      } else if ('value' in step && step.value !== undefined) {
        applyOp(stack[stack.length - 1], Number(step.value) || 0)
      } else if ('op' in step) {
        stack[stack.length - 1].pendingOp = step.op!
      }
    }

    const top = stack[stack.length - 1]
    return Math.round((top.isFirst ? 0 : top.result) * 1000) / 1000
  } catch {
    return 0
  }
}

/** Multi-pass eval so calculated fields can reference other calculated fields. */
export function evalCalculatedFields(
  fields: { id: number; fieldType: string; optionsJson: string | null }[],
  inputValues: Record<number, string | boolean>,
  gender?: string | null,
): Record<number, number> {
  const calculated = fields.filter(f => f.fieldType === 'calculated')
  const values: Record<number, string | boolean> = { ...inputValues }
  const results: Record<number, number> = {}

  for (let pass = 0; pass < calculated.length + 1; pass++) {
    let changed = false
    for (const f of calculated) {
      const n = evalFormula(f.optionsJson, values, gender)
      if (results[f.id] !== n) {
        results[f.id] = n
        values[f.id] = String(n)
        changed = true
      }
    }
    if (!changed) break
  }
  return results
}
