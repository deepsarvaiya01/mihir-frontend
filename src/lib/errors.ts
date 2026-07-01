import { toast } from 'sonner'

type ApiErr = { response?: { data?: { message?: string | string[] } }; message?: string }

export function extractError(err: unknown, fallback: string): string {
  const e = err as ApiErr
  const msg = e?.response?.data?.message ?? e?.message
  if (Array.isArray(msg)) return msg[0] || fallback
  return msg || fallback
}

export function toastError(err: unknown, fallback: string): void {
  toast.error(extractError(err, fallback))
}
