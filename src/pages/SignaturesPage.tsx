import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PenLine,
  Pencil,
  Upload,
  Trash2,
  CheckCircle2,
  Circle,
  RefreshCw,
  X,
  ImageOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { toastError } from '../lib/errors'
import { toTitleCase } from '../lib/utils'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { ConfirmModal } from '../components/ui/Modal'
import { signatureService, type Signature, type UpdateSignatureDto } from '../services/signatures'

/* ─── helpers ────────────────────────────────────────────── */

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/* ─── Upload / Edit modal ────────────────────────────────── */

interface UploadModalProps {
  signature?: Signature | null
  onClose: () => void
  onSave: (name: string, degreeName: string, imageData: string | null) => void
  saving: boolean
}

function UploadModal({ signature, onClose, onSave, saving }: UploadModalProps) {
  const isEdit = !!signature
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(signature?.name ?? '')
  const [degreeName, setDegreeName] = useState(signature?.degreeName ?? '')
  const [preview, setPreview] = useState<string | null>(signature?.imageUrl ?? null)
  const [imageData, setImageData] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, SVG, etc.)')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2 MB')
      return
    }
    const b64 = await fileToBase64(file)
    setImageData(b64)
    setPreview(b64)
    if (!name) setName(file.name.replace(/\.[^/.]+$/, ''))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleSubmit = () => {
    if (!name.trim()) { toast.error('Please enter a signature name'); return }
    if (!isEdit && !imageData) { toast.error('Please select an image'); return }
    onSave(name.trim(), degreeName.trim(), imageData)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{isEdit ? 'Edit Signature' : 'Upload Signature'}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Doctor Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(toTitleCase(e.target.value))}
              placeholder="e.g. Dr. Sharma"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:bg-gray-600"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Degree <span className="font-normal text-gray-400">(optional)</span></label>
            <input
              type="text"
              value={degreeName}
              onChange={e => setDegreeName(toTitleCase(e.target.value))}
              placeholder="e.g. MD, Pathologist"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:bg-gray-600"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Signature Image</label>
            <div
              className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors
                ${dragOver ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/40 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-blue-500 dark:hover:bg-gray-700'}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {preview ? (
                <img src={preview} alt="preview" className="max-h-28 max-w-full rounded-lg object-contain" />
              ) : (
                <>
                  <Upload className="mb-2 h-8 w-8 text-gray-400" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Drop image here or <span className="font-medium text-blue-600">browse</span></p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">PNG, JPG, SVG · max 2 MB</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>
            {isEdit && imageData && (
              <button
                onClick={e => { e.stopPropagation(); setPreview(signature?.imageUrl ?? null); setImageData(null) }}
                className="mt-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
              >
                Revert to current image
              </button>
            )}
            {!isEdit && preview && (
              <button
                onClick={e => { e.stopPropagation(); setPreview(null); setImageData(null) }}
                className="mt-1.5 text-xs text-red-500 hover:text-red-700"
              >
                Remove image
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-700">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Save Signature'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Signature card ─────────────────────────────────────── */

interface SigCardProps {
  sig: Signature
  onActivate: (id: number) => void
  onDeactivate: () => void
  onEdit: (sig: Signature) => void
  onDelete: (sig: Signature) => void
  busy: boolean
}

function SigCard({ sig, onActivate, onDeactivate, onEdit, onDelete, busy }: SigCardProps) {
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition-all dark:bg-gray-800
        ${sig.isActive
          ? 'border-blue-500 shadow-blue-100 dark:shadow-blue-900/40'
          : 'border-gray-100 hover:border-gray-200 hover:shadow-md dark:border-gray-700 dark:hover:border-gray-600'
        }`}
    >
      {sig.isActive && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow">
          <CheckCircle2 className="h-3 w-3" /> Active
        </div>
      )}

      <div className="flex h-44 items-center justify-center bg-gray-50 p-4 dark:bg-gray-700">
        {sig.imageUrl ? (
          <img src={sig.imageUrl} alt={sig.name} className="max-h-full max-w-full rounded-lg object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-300 dark:text-gray-600">
            <ImageOff className="h-10 w-10" />
            <span className="text-xs">No image</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{sig.name}</p>
          {sig.degreeName && (
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">({sig.degreeName})</p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {new Date(sig.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>

        <div className="ml-3 flex shrink-0 items-center gap-1">
          {sig.isActive ? (
            <button
              onClick={() => onDeactivate()}
              disabled={busy}
              title="Remove active status"
              className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
            >
              <Circle className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => onActivate(sig.id)}
              disabled={busy}
              title="Set as active signature"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={() => onEdit(sig)}
            disabled={busy}
            title="Edit signature"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <Pencil className="h-4 w-4" />
          </button>

          <button
            onClick={() => onDelete(sig)}
            disabled={busy}
            title="Delete signature"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main page ──────────────────────────────────────────── */

export default function SignaturesPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editSig, setEditSig] = useState<Signature | null>(null)
  const [deleteSig, setDeleteSig] = useState<Signature | null>(null)

  const { data: signatures = [], isLoading, refetch } = useQuery({
    queryKey: ['signatures'],
    queryFn: signatureService.getAll,
  })

  const createMut = useMutation({
    mutationFn: signatureService.create,
    onSuccess: () => {
      toast.success('Signature uploaded successfully')
      qc.invalidateQueries({ queryKey: ['signatures'] })
      setShowModal(false)
    },
    onError: (err) => toastError(err, 'Failed to upload signature'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: UpdateSignatureDto }) => signatureService.update(id, dto),
    onSuccess: () => {
      toast.success('Signature updated successfully')
      qc.invalidateQueries({ queryKey: ['signatures'] })
      setEditSig(null)
    },
    onError: (err) => toastError(err, 'Failed to update signature'),
  })

  const activateMut = useMutation({
    mutationFn: signatureService.activate,
    onSuccess: () => {
      toast.success('Signature set as active')
      qc.invalidateQueries({ queryKey: ['signatures'] })
    },
    onError: (err) => toastError(err, 'Failed to activate signature'),
  })

  const deactivateMut = useMutation({
    mutationFn: signatureService.deactivate,
    onSuccess: () => {
      toast.success('Signature deactivated')
      qc.invalidateQueries({ queryKey: ['signatures'] })
    },
    onError: (err) => toastError(err, 'Failed to deactivate signature'),
  })

  const deleteMut = useMutation({
    mutationFn: signatureService.delete,
    onSuccess: () => {
      toast.success('Signature archived')
      qc.invalidateQueries({ queryKey: ['signatures'] })
      setDeleteSig(null)
    },
    onError: (err) => toastError(err, 'Failed to archive signature'),
  })

  const busy = createMut.isPending || updateMut.isPending || activateMut.isPending || deactivateMut.isPending || deleteMut.isPending
  const activeCount = signatures.filter(s => s.isActive).length

  return (
    <div>
      <Header
        title="Signature Management"
        subtitle="Upload signature images and mark one or more as active for lab reports"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={<RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />}
              onClick={() => refetch()}
            >
              Refresh
            </Button>
            {signatures.length > 0 && (
              <Button icon={<Upload className="h-4 w-4" />} onClick={() => setShowModal(true)}>
                Upload Signature
              </Button>
            )}
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {/* Stats */}
        <div className="flex gap-4">
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Total</p>
            <p className="mt-0.5 text-2xl font-bold text-gray-900 dark:text-white">{signatures.length}</p>
          </div>
          <div className={`rounded-2xl border px-5 py-4 shadow-sm ${activeCount > 0 ? 'border-blue-100 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/30' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Active ({activeCount})</p>
            <p className={`mt-0.5 truncate text-lg font-bold ${activeCount > 0 ? 'text-blue-700 dark:text-blue-400' : 'text-gray-400 dark:text-gray-600'}`}>
              {activeCount > 0 ? signatures.filter(s => s.isActive).map(s => s.name).join(', ') : '—'}
            </p>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-700" />
            ))}
          </div>
        ) : signatures.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-700">
              <PenLine className="h-8 w-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">No signatures yet</h3>
            <p className="mt-1 max-w-xs text-sm text-gray-500 dark:text-gray-400">
              Upload your first signature image. The active one will appear on all generated reports.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-5 flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Upload className="h-4 w-4" />
              Upload First Signature
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {signatures.map(sig => (
              <SigCard
                key={sig.id}
                sig={sig}
                busy={busy}
                onActivate={id => activateMut.mutate(id)}
                onDeactivate={() => deactivateMut.mutate(sig.id)}
                onEdit={sig => setEditSig(sig)}
                onDelete={sig => setDeleteSig(sig)}
              />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <UploadModal
          onClose={() => setShowModal(false)}
          saving={createMut.isPending}
          onSave={(name, degreeName, imageData) => createMut.mutate({ name, degreeName: degreeName || undefined, imageData: imageData! })}
        />
      )}

      {editSig && (
        <UploadModal
          signature={editSig}
          onClose={() => setEditSig(null)}
          saving={updateMut.isPending}
          onSave={(name, degreeName, imageData) => {
            const dto: UpdateSignatureDto = { name, degreeName: degreeName || undefined }
            if (imageData) dto.imageData = imageData
            updateMut.mutate({ id: editSig.id, dto })
          }}
        />
      )}

      <ConfirmModal
        open={!!deleteSig}
        onClose={() => setDeleteSig(null)}
        onConfirm={() => deleteSig && deleteMut.mutate(deleteSig.id)}
        title="Archive Signature"
        message={`Are you sure you want to archive "${deleteSig?.name}"? You can restore it later from the archived view.`}
        confirmLabel="Archive Signature"
        variant="danger"
        loading={deleteMut.isPending}
      />
    </div>
  )
}
