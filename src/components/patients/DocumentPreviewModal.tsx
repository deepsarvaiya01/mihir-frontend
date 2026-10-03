import { Download, ExternalLink, FileText } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

type Kind = 'image' | 'pdf' | 'other'

/** Blob URLs carry no extension, so the kind comes from the file name (or the File's MIME type). */
function kindOf(name: string, mimeType?: string): Kind {
  if (mimeType?.startsWith('image/') || /\.(jpe?g|png|gif|webp)$/i.test(name)) return 'image'
  if (mimeType === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf'
  return 'other'
}

/**
 * Shows a document inside the app — works for saved documents (their URL) and for files
 * picked but not uploaded yet (an object URL from URL.createObjectURL).
 */
export function DocumentPreviewModal({ name, url, mimeType, onClose }: {
  name: string
  url: string
  /** MIME type of a local File, when known */
  mimeType?: string
  onClose: () => void
}) {
  const kind = kindOf(name, mimeType)
  const isLocal = url.startsWith('blob:')

  return (
    <Modal open onClose={onClose} title={name} subtitle={isLocal ? 'Not uploaded yet — saved when the patient is created' : undefined}
      size="2xl"
      footer={
        <>
          <a href={url} target="_blank" rel="noopener noreferrer" download={isLocal ? name : undefined}>
            <Button variant="secondary" icon={isLocal ? <Download className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}>
              {isLocal ? 'Download' : 'Open in new tab'}
            </Button>
          </a>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      {kind === 'image' ? (
        <div className="flex max-h-[72vh] justify-center overflow-auto rounded-lg bg-gray-50 p-2 dark:bg-gray-900/40">
          <img src={url} alt={name} className="max-w-full object-contain" />
        </div>
      ) : kind === 'pdf' ? (
        <iframe src={url} title={name} className="h-[72vh] w-full rounded-lg border border-gray-200 bg-white dark:border-gray-700" />
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <FileText className="h-12 w-12 text-gray-300" />
          <p className="text-sm text-gray-600 dark:text-gray-300">This file type can't be previewed in the browser.</p>
          <p className="text-xs text-gray-400">Use {isLocal ? 'Download' : 'Open in new tab'} below to view it.</p>
        </div>
      )}
    </Modal>
  )
}
