import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Send, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { patientService } from '../../services/patients'
import { toastError } from '../../lib/errors'
import { formatDateTime } from '../billing/format'
import type { Patient } from '../../types'

/** View, add and delete a patient's remarks. */
export function RemarksModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const { data: remarks = [], isLoading } = useQuery({
    queryKey: ['patient-remarks', patient.id],
    queryFn: () => patientService.getRemarks(patient.id),
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['patient-remarks', patient.id] })
    qc.invalidateQueries({ queryKey: ['patients'] }) // remark counts on the list
  }

  const addMutation = useMutation({
    mutationFn: () => patientService.addRemark(patient.id, text.trim()),
    onSuccess: () => { setText(''); refresh(); toast.success('Remark added') },
    onError: (err) => toastError(err, 'Failed to add remark'),
  })

  const deleteMutation = useMutation({
    mutationFn: (remarkId: number) => patientService.deleteRemark(patient.id, remarkId),
    onSuccess: () => { setConfirmDeleteId(null); refresh(); toast.success('Remark deleted') },
    onError: (err) => toastError(err, 'Failed to delete remark'),
  })

  const canAdd = text.trim().length > 0 && !addMutation.isPending

  return (
    <Modal open onClose={onClose} title="Remarks" subtitle={`${patient.fullName} · ${patient.patientCode}`} size="md">
      <div className="space-y-4">
        {/* New remark */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900/40">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canAdd) addMutation.mutate() }}
            rows={3}
            maxLength={1000}
            autoFocus
            placeholder="Write a remark — e.g. sample re-collection needed, report to be sent by email..."
            className="w-full resize-none bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400">Ctrl + Enter to add · {text.length}/1000</span>
            <Button size="sm" icon={<Send className="h-3.5 w-3.5" />} loading={addMutation.isPending}
              disabled={!canAdd} onClick={() => addMutation.mutate()}>
              Add Remark
            </Button>
          </div>
        </div>

        {/* Existing remarks */}
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
        ) : remarks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center dark:border-gray-700">
            <p className="text-2xl">📝</p>
            <p className="mt-1 text-sm text-gray-400">No remarks yet</p>
          </div>
        ) : (
          <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
            {remarks.map(r => {
              const dt = formatDateTime(r.createdAt)
              const confirming = confirmDeleteId === r.id
              return (
                <div key={r.id} className={`group rounded-xl border px-3.5 py-3 transition-colors ${
                  confirming ? 'border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-900/10' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
                }`}>
                  <p className="whitespace-pre-wrap break-words text-sm text-gray-800 dark:text-gray-100">{r.text}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gray-400">
                      {r.createdBy ?? 'Unknown'} · {dt.date}, {dt.time}
                    </span>
                    {confirming ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-red-600">Delete this remark?</span>
                        <button type="button" onClick={() => setConfirmDeleteId(null)}
                          className="rounded-md px-2 py-0.5 text-[11px] font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
                          Cancel
                        </button>
                        <button type="button" onClick={() => deleteMutation.mutate(r.id)} disabled={deleteMutation.isPending}
                          className="rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                          {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    ) : (
                      <button type="button" title="Delete remark" onClick={() => setConfirmDeleteId(r.id)}
                        className="rounded-md p-1 text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100 dark:text-gray-500 dark:hover:bg-red-900/30">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}
