interface FormulaFrame { result: number; pendingOp: string | null; isFirst: boolean }

export interface FormulaStep { fieldId?: number; op?: string; value?: number; paren?: '(' | ')' }

/** Evaluates a stored calculated-field formula (steps with optional paren grouping and a %-of operator). */
export function evalFormula(optionsJson: string | null, values: Record<number, string | boolean>): number {
  if (!optionsJson) return 0
  try {
    const steps: FormulaStep[] = JSON.parse(optionsJson)
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
): Record<number, number> {
  const calculated = fields.filter(f => f.fieldType === 'calculated')
  const values: Record<number, string | boolean> = { ...inputValues }
  const results: Record<number, number> = {}

  for (let pass = 0; pass < calculated.length + 1; pass++) {
    let changed = false
    for (const f of calculated) {
      const n = evalFormula(f.optionsJson, values)
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
