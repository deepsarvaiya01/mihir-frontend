import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { toastError } from '../../lib/errors'
import { orderService } from '../../services/orders'
import { reportShareService } from '../../services/reportShares'
import { labSettingsService } from '../../services/labSettings'
import { signatureService } from '../../services/signatures'
import { logoService } from '../../services/logos'
import {
  generateReceipt, generateCombinedReport, viewCombinedReport, printCombinedReport, viewMergedAttachments,
} from '../../utils/generateReport'
import type { Order } from '../../types'
import type { PaymentUpdate } from './PaymentModal'

/**
 * Every billing / report action for a receipt (a group of orders sharing one receipt number).
 * Reports are always combined across every approved test on the receipt.
 */
export function useReceiptActions(allOrders: Order[], onPaymentSaved?: () => void) {
  const qc = useQueryClient()

  // Pre-fetch lab settings, signatures and logo for report generation
  const { data: labSettings = {} } = useQuery({ queryKey: ['lab-settings'], queryFn: labSettingsService.getAll })
  const { data: activeSignatures = [] } = useQuery({ queryKey: ['active-signature'], queryFn: signatureService.getActive })
  const { data: activeLogo = null } = useQuery({ queryKey: ['logos', 'active'], queryFn: logoService.getActive })

  /**
   * Fetches results ready to feed a report generator. Given one order: every approved
   * test on its receipt. Given a list (e.g. all of a patient's bills): its approved tests.
   */
  const fetchReportOptions = async (target: Order | Order[]) => {
    let targets: Order[]
    if (Array.isArray(target)) {
      targets = target.filter(o => o.status === 'APPROVED')
    } else {
      const siblings = target.receiptNumber
        ? allOrders.filter(o => o.receiptNumber === target.receiptNumber && o.status === 'APPROVED')
        : []
      targets = siblings.length > 0 ? siblings : [target]
    }
    const results = await Promise.all(targets.map(o => orderService.getResults(o.id)))
    return results.map(data => ({
      order: data.order,
      results: data.results.map(r => ({
        fieldName: r.fieldName,
        fieldType: r.fieldType,
        value: r.value,
        unit: r.unit ?? null,
        referenceRange: r.referenceRange ?? null,
        isSectionHeader: r.isSectionHeader ?? false,
        isMainHeader: r.isMainHeader ?? false,
        isLineResult: r.isLineResult ?? false,
      })),
      labSettings,
      signatures: activeSignatures,
      activeLogo,
    }))
  }

  const updatePayment = useMutation({
    mutationFn: (updates: PaymentUpdate[]) =>
      Promise.all(updates.map(u => orderService.updatePayment(u.id, {
        paymentStatus: u.paymentStatus,
        paymentType: u.paymentType || null,
        amount: u.amount,
        discount: u.discount,
      }))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      onPaymentSaved?.()
      toast.success('Payment updated')
    },
    onError: (err) => toastError(err, 'Failed to update payment'),
  })

  const downloadReport = useMutation({
    mutationFn: fetchReportOptions,
    onSuccess: (optionsList) => {
      generateCombinedReport(optionsList, 'letterhead')
        .then(() => toast.success('Report downloaded'))
        .catch((e: Error) => toast.error(e?.message || 'Failed to generate report'))
    },
    onError: (err) => toastError(err, 'Failed to generate report'),
  })

  const viewReport = useMutation({
    mutationFn: fetchReportOptions,
    onSuccess: (optionsList) => {
      viewCombinedReport(optionsList, 'letterhead').catch((e: Error) => toast.error(e?.message || 'Failed to open report'))
    },
    onError: (err) => toastError(err, 'Failed to open report'),
  })

  const printReport = useMutation({
    mutationFn: fetchReportOptions,
    onSuccess: (optionsList) => {
      printCombinedReport(optionsList, 'letterhead').catch((e: Error) => toast.error(e?.message || 'Failed to print report'))
    },
    onError: (err) => toastError(err, 'Failed to print report'),
  })

  const plainReport = useMutation({
    mutationFn: fetchReportOptions,
    onSuccess: (optionsList) => {
      generateCombinedReport(optionsList, 'plain')
        .then(() => toast.success('Plain report downloaded'))
        .catch((e: Error) => toast.error(e?.message || 'Failed to generate report'))
    },
    onError: (err) => toastError(err, 'Failed to generate report'),
  })

  const printPlainReport = useMutation({
    mutationFn: fetchReportOptions,
    onSuccess: (optionsList) => {
      printCombinedReport(optionsList, 'plain').catch((e: Error) => toast.error(e?.message || 'Failed to print report'))
    },
    onError: (err) => toastError(err, 'Failed to print report'),
  })

  // Merges every uploaded attachment on this receipt (one per test) into a single PDF and opens it
  const viewAttachments = useMutation({
    mutationFn: (group: Order[]) => {
      const urls = group.map(o => o.attachmentUrl).filter((u): u is string => !!u)
      return viewMergedAttachments(urls)
    },
    onError: () => toast.error('Failed to open uploaded document'),
  })

  const shareReport = useMutation({
    mutationFn: (orderId: number) => reportShareService.createToken(orderId),
    onSuccess: (data) => {
      const url = `${window.location.origin}/r/${data.token}`
      navigator.clipboard.writeText(url).then(() => toast.success('Report link copied to clipboard!'))
    },
    onError: (err) => toastError(err, 'Failed to create share link'),
  })

  const printReceipt = useMutation({
    mutationFn: (group: Order[]) =>
      generateReceipt({ orders: group, labSettings, signatures: activeSignatures, activeLogo }),
    onSuccess: () => toast.success('Receipt downloaded'),
    onError: (err) => toastError(err, 'Failed to generate receipt'),
  })

  return {
    updatePayment, downloadReport, viewReport, printReport, plainReport, printPlainReport,
    viewAttachments, shareReport, printReceipt,
  }
}

export type ReceiptActions = ReturnType<typeof useReceiptActions>

/** Groups orders sharing one receipt into a single bill — we always bill/report a receipt as one unit. */
export function groupByReceipt(orders: Order[]): Order[][] {
  const groups: Order[][] = []
  const byKey = new Map<string, Order[]>()
  for (const o of orders) {
    const key = o.receiptNumber ?? `order-${o.id}`
    const existing = byKey.get(key)
    if (existing) existing.push(o)
    else {
      const group: Order[] = [o]
      byKey.set(key, group)
      groups.push(group)
    }
  }
  return groups
}
