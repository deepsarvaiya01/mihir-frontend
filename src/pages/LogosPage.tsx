import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ImageIcon,
  Upload,
  Trash2,
  CheckCircle2,
  Circle,
  RefreshCw,
  X,
  ImageOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { ConfirmModal } from '../components/ui/Modal'
import { logoService } from '../services/logos'
import type { Logo } from '../types'

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
    if (!name) setName(file.name.replace(/\.[^/.]+$/, ''))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleSubmit = () => {
    if (!name.trim()) { toast.error('Please enter a name for this logo'); return }
    if (!imageData)   { toast.error('Please select an image');              return }
    onSave(name.trim(), imageData)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Upload Logo</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Company / Lab Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Mihir Diagnostic Lab"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <p className="mt-1 text-xs text-gray-400">This name will be shown in the app header and on reports when this logo is active.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Logo Image</label>
            <div
              className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors
                ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/40'}`}
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
                  <p className="text-sm text-gray-500">Drop image here or <span className="font-medium text-blue-600">browse</span></p>
                  <p className="mt-1 text-xs text-gray-400">PNG, JPG, SVG · max 2 MB</p>
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
                className="mt-1.5 text-xs text-red-500 hover:text-red-700"
              >
                Remove image
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            Save Logo
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Logo card ──────────────────────────────────────────── */

interface LogoCardProps {
  logo: Logo
  onActivate: (id: number) => void
  onDeactivate: () => void
  onDelete: (logo: Logo) => void
  busy: boolean
}

function LogoCard({ logo, onActivate, onDeactivate, onDelete, busy }: LogoCardProps) {
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition-all
        ${logo.isActive
          ? 'border-blue-500 shadow-blue-100'
          : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
        }`}
    >
      {logo.isActive && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow">
          <CheckCircle2 className="h-3 w-3" /> Active
        </div>
      )}

      <div className="flex h-44 items-center justify-center bg-gray-50 p-4">
        {logo.imageUrl ? (
          <img src={logo.imageUrl} alt={logo.name} className="max-h-full max-w-full rounded-lg object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-300">
            <ImageOff className="h-10 w-10" />
            <span className="text-xs">No image</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{logo.name}</p>
          <p className="text-xs text-gray-400">
            {new Date(logo.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>

        <div className="ml-3 flex shrink-0 items-center gap-1">
          {logo.isActive ? (
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
              onClick={() => onActivate(logo.id)}
              disabled={busy}
              title="Set as active logo"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={() => onDelete(logo)}
            disabled={busy}
            title="Delete logo"
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

export default function LogosPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [deleteLogo, setDeleteLogo] = useState<Logo | null>(null)

  const { data: logos = [], isLoading, refetch } = useQuery({
    queryKey: ['logos'],
    queryFn: logoService.getAll,
  })

  const createMut = useMutation({
    mutationFn: ({ name, imageData }: { name: string; imageData: string }) =>
      logoService.create({ name, imageData }),
    onSuccess: () => {
      toast.success('Logo uploaded successfully')
      qc.invalidateQueries({ queryKey: ['logos'] })
      setShowModal(false)
    },
    onError: () => toast.error('Failed to upload logo'),
  })

  const activateMut = useMutation({
    mutationFn: logoService.activate,
    onSuccess: () => {
      toast.success('Logo set as active')
      qc.invalidateQueries({ queryKey: ['logos'] })
    },
    onError: () => toast.error('Failed to activate logo'),
  })

  const deactivateMut = useMutation({
    mutationFn: logoService.deactivateAll,
    onSuccess: () => {
      toast.success('Active logo cleared')
      qc.invalidateQueries({ queryKey: ['logos'] })
    },
    onError: () => toast.error('Failed to deactivate'),
  })

  const deleteMut = useMutation({
    mutationFn: logoService.delete,
    onSuccess: () => {
      toast.success('Logo deleted')
      qc.invalidateQueries({ queryKey: ['logos'] })
      setDeleteLogo(null)
    },
    onError: () => toast.error('Failed to delete logo'),
  })

  const busy = createMut.isPending || activateMut.isPending || deactivateMut.isPending || deleteMut.isPending
  const activeLogo = logos.find(l => l.isActive)

  return (
    <div>
      <Header
        title="Logo Management"
        subtitle="Upload company logos and activate one to display across the app and on reports"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={<RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />}
              onClick={() => refetch()}
            >
              Refresh
            </Button>
            <Button icon={<Upload className="h-4 w-4" />} onClick={() => setShowModal(true)}>
              Upload Logo
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {/* Stats */}
        <div className="flex gap-4">
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total</p>
            <p className="mt-0.5 text-2xl font-bold text-gray-900">{logos.length}</p>
          </div>
          <div className={`rounded-2xl border px-5 py-4 shadow-sm ${activeLogo ? 'border-blue-100 bg-blue-50' : 'border-gray-200 bg-white'}`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Active</p>
            <p className={`mt-0.5 text-lg font-bold ${activeLogo ? 'text-blue-700' : 'text-gray-400'}`}>
              {activeLogo?.name ?? '—'}
            </p>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        ) : logos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <ImageIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">No logos yet</h3>
            <p className="mt-1 max-w-xs text-sm text-gray-500">
              Upload your first logo. The active one will appear in the sidebar header and on all generated reports.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-5 flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Upload className="h-4 w-4" />
              Upload First Logo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {logos.map(logo => (
              <LogoCard
                key={logo.id}
                logo={logo}
                busy={busy}
                onActivate={id => activateMut.mutate(id)}
                onDeactivate={() => deactivateMut.mutate()}
                onDelete={logo => setDeleteLogo(logo)}
              />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <UploadModal
          onClose={() => setShowModal(false)}
          saving={createMut.isPending}
          onSave={(name, imageData) => createMut.mutate({ name, imageData })}
        />
      )}

      <ConfirmModal
        open={!!deleteLogo}
        onClose={() => setDeleteLogo(null)}
        onConfirm={() => deleteLogo && deleteMut.mutate(deleteLogo.id)}
        title="Delete Logo"
        message={`Are you sure you want to delete "${deleteLogo?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Logo"
        variant="danger"
        loading={deleteMut.isPending}
      />
    </div>
  )
}
