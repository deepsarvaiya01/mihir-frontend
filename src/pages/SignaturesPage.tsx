import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PenLine,
  Upload,
  Trash2,
  CheckCircle2,
  Circle,
  RefreshCw,
  X,
  ImageOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { signatureService, type Signature } from '../services/signatures'

/* ─── helpers ────────────────────────────────────────────── */

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/* ─── Upload modal ───────────────────────────────────────── */

interface UploadModalProps {
  onClose: () => void
  onSave: (name: string, imageData: string) => void
  saving: boolean
}

function UploadModal({ onClose, onSave, saving }: UploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
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
    // Auto-fill name from filename if blank
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
    if (!imageData)   { toast.error('Please select an image');         return }
    onSave(name.trim(), imageData)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900">Upload Signature</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Name field */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Signature Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Dr. Sharma"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Drop zone */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Signature Image</label>
            <div
              className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors
                ${dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40'}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {preview ? (
                <img
                  src={preview}
                  alt="preview"
                  className="max-h-28 max-w-full rounded-lg object-contain"
                />
              ) : (
                <>
                  <Upload className="mb-2 h-8 w-8 text-slate-400" />
                  <p className="text-sm text-slate-500">Drop image here or <span className="font-medium text-indigo-600">browse</span></p>
                  <p className="mt-1 text-xs text-slate-400">PNG, JPG, SVG · max 2 MB</p>
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
            {preview && (
              <button
                onClick={e => { e.stopPropagation(); setPreview(null); setImageData(null) }}
                className="mt-1.5 text-xs text-rose-500 hover:text-rose-700"
              >
                Remove image
              </button>
            )}
          </div>
        </div>

        {/* footer */}
        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            Save Signature
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
  onDelete: (id: number) => void
  busy: boolean
}

function SigCard({ sig, onActivate, onDeactivate, onDelete, busy }: SigCardProps) {
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition-all
        ${sig.isActive
          ? 'border-indigo-500 shadow-indigo-100'
          : 'border-slate-100 hover:border-slate-200 hover:shadow-md'
        }`}
    >
      {/* Active badge */}
      {sig.isActive && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow">
          <CheckCircle2 className="h-3 w-3" /> Active
        </div>
      )}

      {/* Image area */}
      <div className="flex h-44 items-center justify-center bg-slate-50 p-4">
        {sig.imageData ? (
          <img
            src={sig.imageData}
            alt={sig.name}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-300">
            <ImageOff className="h-10 w-10" />
            <span className="text-xs">No image</span>
          </div>
        )}
      </div>

      {/* Info + actions */}
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{sig.name}</p>
          <p className="text-xs text-slate-400">
            {new Date(sig.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>

        <div className="ml-3 flex shrink-0 items-center gap-1">
          {/* Activate / deactivate toggle */}
          {sig.isActive ? (
            <button
              onClick={() => onDeactivate()}
              disabled={busy}
              title="Remove active status"
              className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
            >
              <Circle className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => onActivate(sig.id)}
              disabled={busy}
              title="Set as active signature"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
            </button>
          )}

          {/* Delete */}
          <button
            onClick={() => onDelete(sig.id)}
            disabled={busy}
            title="Delete signature"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"
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
    onError: () => toast.error('Failed to upload signature'),
  })

  const activateMut = useMutation({
    mutationFn: signatureService.activate,
    onSuccess: () => {
      toast.success('Signature set as active')
      qc.invalidateQueries({ queryKey: ['signatures'] })
    },
    onError: () => toast.error('Failed to activate signature'),
  })

  const deactivateMut = useMutation({
    mutationFn: signatureService.deactivateAll,
    onSuccess: () => {
      toast.success('Active signature cleared')
      qc.invalidateQueries({ queryKey: ['signatures'] })
    },
    onError: () => toast.error('Failed to deactivate'),
  })

  const deleteMut = useMutation({
    mutationFn: signatureService.delete,
    onSuccess: () => {
      toast.success('Signature deleted')
      qc.invalidateQueries({ queryKey: ['signatures'] })
    },
    onError: () => toast.error('Failed to delete signature'),
  })

  const busy = createMut.isPending || activateMut.isPending || deactivateMut.isPending || deleteMut.isPending

  const activeCount = signatures.filter(s => s.isActive).length

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Signature Management</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Upload signature images and mark one as active for use in lab reports.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            <Upload className="h-4 w-4" />
            Upload Signature
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4">
        <div className="rounded-xl border border-slate-100 bg-white px-5 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total</p>
          <p className="mt-0.5 text-2xl font-bold text-slate-900">{signatures.length}</p>
        </div>
        <div className={`rounded-xl border px-5 py-3 shadow-sm ${activeCount > 0 ? 'border-indigo-100 bg-indigo-50' : 'border-slate-100 bg-white'}`}>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Active</p>
          <p className={`mt-0.5 text-2xl font-bold ${activeCount > 0 ? 'text-indigo-700' : 'text-slate-400'}`}>
            {activeCount > 0 ? signatures.find(s => s.isActive)?.name : '—'}
          </p>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : signatures.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <PenLine className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">No signatures yet</h3>
          <p className="mt-1 max-w-xs text-sm text-slate-500">
            Upload your first signature image. The active one will appear on all generated reports.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-5 flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
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
              onDeactivate={() => deactivateMut.mutate()}
              onDelete={id => {
                if (window.confirm(`Delete "${sig.name}"?`)) deleteMut.mutate(id)
              }}
            />
          ))}
        </div>
      )}

      {/* Upload modal */}
      {showModal && (
        <UploadModal
          onClose={() => setShowModal(false)}
          saving={createMut.isPending}
          onSave={(name, imageData) => createMut.mutate({ name, imageData })}
        />
      )}
    </div>
  )
}
