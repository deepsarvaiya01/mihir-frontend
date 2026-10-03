import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Eye, FileText, Image as ImageIcon, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { patientService } from '../../services/patients'
import { toastError } from '../../lib/errors'
import { formatDateTime } from '../billing/format'
import { DocumentPreviewModal } from './DocumentPreviewModal'

/** The API accepts ~10 MB JSON bodies; base64 adds a third, so cap the raw file a little under 7.5 MB. */
const MAX_BYTES = 7 * 1024 * 1024
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx'

const isImage = (name: string) => /\.(jpe?g|png|webp|gif)$/i.test(name)

/** 📎 with a count badge — opens the patient's documents. */
export function DocumentsButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button type="button" onClick={e => { e.stopPropagation(); onClick() }}
      title={count > 0 ? `${count} document${count !== 1 ? 's' : ''} — click to view` : 'No documents — click to upload'}
      className={`relative flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-all hover:bg-cyan-50 dark:hover:bg-cyan-900/20 ${
        count > 0 ? '' : 'opacity-35 grayscale hover:opacity-100 hover:grayscale-0'
      }`}>
      <span aria-hidden>📎</span>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-gray-800">
          {count}
        </span>
      )}
    </button>
  )
}

/** View, open, upload and delete a patient's documents. */
export function DocumentsModal({ patient, onClose }: {
  patient: { id: number; fullName: string; patientCode: string }
  onClose: () => void
}) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null)

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['patient-documents', patient.id],
    queryFn: () => patientService.getDocuments(patient.id),
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['patient-documents', patient.id] })
    qc.invalidateQueries({ queryKey: ['patient', patient.id] })
    qc.invalidateQueries({ queryKey: ['patients'] }) // document counts on the list
  }

  const uploadMutation = useMutation({
    mutationFn: (file: File) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Could not read the file'))
      reader.readAsDataURL(file)
    }).then(base64 => patientService.uploadDocument(patient.id, file.name, base64)),
    onSuccess: () => { refresh(); toast.success('Document uploaded') },
    onError: (err) => toastError(err, 'Failed to upload document'),
  })

  const deleteMutation = useMutation({
    mutationFn: (docId: number) => patientService.deleteDocument(patient.id, docId),
    onSuccess: () => { setConfirmDeleteId(null); refresh(); toast.success('Document deleted') },
    onError: (err) => toastError(err, 'Failed to delete document'),
  })

  const onPick = (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_BYTES) { toast.error('File must be under 7 MB'); return }
    uploadMutation.mutate(file)
  }

  return (
    <Modal open onClose={onClose} title="Documents" subtitle={`${patient.fullName} · ${patient.patientCode}`} size="md"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <div className="space-y-4">
        <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
          onChange={e => { onPick(e.target.files?.[0]); e.target.value = '' }} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadMutation.isPending}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); onPick(e.dataTransfer.files?.[0]) }}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-5 text-center transition-colors hover:border-cyan-300 hover:bg-cyan-50/40 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:border-cyan-800">
          {uploadMutation.isPending
            ? <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
            : <Upload className="h-6 w-6 text-gray-400" />}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {uploadMutation.isPending ? 'Uploading…' : 'Click or drop a file to upload'}
          </span>
          <span className="text-[11px] text-gray-400">PDF, image or Word · max 7 MB</span>
        </button>

        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
        ) : docs.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">No documents uploaded yet</p>
        ) : (
          <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
            {docs.map(doc => {
              const dt = formatDateTime(doc.createdAt)
              const confirming = confirmDeleteId === doc.id
              return (
                <div key={doc.id} className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                  confirming ? 'border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-900/10' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
                }`}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400">
                    {isImage(doc.name) ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  </div>
                  <button type="button" onClick={() => setPreview({ name: doc.name, url: doc.url })}
                    className="group/name min-w-0 flex-1 text-left" title="Preview">
                    <p className="truncate text-sm font-medium text-gray-800 group-hover/name:text-cyan-700 dark:text-gray-100" title={doc.name}>{doc.name}</p>
                    <p className="text-[11px] text-gray-400">{dt.date}, {dt.time}</p>
                  </button>
                  {confirming ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button type="button" onClick={() => setConfirmDeleteId(null)}
                        className="rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
                        Cancel
                      </button>
                      <button type="button" onClick={() => deleteMutation.mutate(doc.id)} disabled={deleteMutation.isPending}
                        className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                        {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => setPreview({ name: doc.name, url: doc.url })}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-50 dark:text-cyan-400 dark:hover:bg-cyan-900/30">
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </button>
                      <a href={doc.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-50 dark:text-cyan-400 dark:hover:bg-cyan-900/30">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button type="button" title="Delete document" onClick={() => setConfirmDeleteId(doc.id)}
                        className="rounded-md p-1.5 text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100 dark:text-gray-500 dark:hover:bg-red-900/30">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {preview && <DocumentPreviewModal name={preview.name} url={preview.url} onClose={() => setPreview(null)} />}
    </Modal>
  )
}
