'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { ImagePlus, Loader2, Trash2, TriangleAlert } from 'lucide-react'
import type { ProductImage } from '@/lib/domain/catalog'
import { MAX_UPLOAD_BYTES } from '@/lib/uploads'
import { Button } from '@/components/ui/button'

/**
 * Product photography upload.
 *
 * Uploads immediately on selection rather than deferring to form submit. A
 * multi-megabyte file inside a form post means the operator waits for the
 * upload after filling in thirty other fields, and loses all of them if it
 * fails. Uploading first makes the failure cheap and immediate.
 *
 * The processed images ride to the server action as hidden inputs, so this
 * needs no separate save step and the form remains a plain form post.
 *
 * Photography replaces the generated line art when present — see
 * `<ProductArtwork />` for why the drawings are the default.
 */

interface ImageUploadProps {
  name: string
  initial: ProductImage[]
}

export function ImageUpload({ name, initial }: ImageUploadProps) {
  const [images, setImages] = useState<ProductImage[]>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(files: FileList | null) {
    if (!files?.length) return

    setBusy(true)
    setError(null)

    // Sequential, not parallel. Each upload holds a decoded bitmap in memory
    // on the server; four at once from three operators is how the box runs
    // out of memory.
    for (const file of Array.from(files).slice(0, 6)) {
      if (file.size > MAX_UPLOAD_BYTES) {
        setError(`${file.name} is over the ${MAX_UPLOAD_BYTES / 1024 / 1024} MB limit.`)
        continue
      }

      const body = new FormData()
      body.append('file', file)
      body.append('alt', file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '))

      try {
        const response = await fetch('/api/admin/upload', { method: 'POST', body })
        const payload = (await response.json()) as { image?: ProductImage; error?: string }

        if (!response.ok || !payload.image) {
          setError(payload.error ?? 'That upload was rejected.')
          continue
        }

        setImages((current) => {
          // The storage key is a hash of the content, so re-uploading the same
          // file yields the same URL. Adding it twice would render a duplicate.
          if (current.some((image) => image.url === payload.image!.url)) return current
          return [...current, payload.image!]
        })
      } catch {
        setError('The upload could not reach the server.')
      }
    }

    setBusy(false)
    // Cleared so selecting the same file again still fires a change event.
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      {/* Hidden inputs — the form posts these, not the files. */}
      {images.map((image, index) => (
        <input
          key={image.url}
          type="hidden"
          name={name}
          value={JSON.stringify({ ...image, position: index })}
        />
      ))}

      {images.length > 0 && (
        <ul className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((image) => (
            <li
              key={image.url}
              className="group relative aspect-4/3 overflow-hidden rounded-lg border border-border bg-surface-2"
            >
              <Image
                src={image.url}
                alt={image.alt}
                fill
                sizes="140px"
                className="object-cover"
                {...(image.blurDataUrl
                  ? { placeholder: 'blur' as const, blurDataURL: image.blurDataUrl }
                  : {})}
              />
              <button
                type="button"
                onClick={() =>
                  setImages((current) => current.filter((entry) => entry.url !== image.url))
                }
                aria-label={`Remove ${image.alt}`}
                className="absolute top-1 right-1 rounded-md bg-bg/85 p-1.5 text-muted opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-danger"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        // A hint for the file picker only. The server sniffs the actual bytes
        // and re-encodes; nothing here is trusted.
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        className="sr-only"
        onChange={(event) => void upload(event.target.files)}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        leadingIcon={
          busy ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="size-3.5" aria-hidden />
          )
        }
      >
        {busy ? 'Processing…' : images.length > 0 ? 'Add another' : 'Upload photography'}
      </Button>

      <p className="mt-2 text-[12px] leading-relaxed text-faint">
        JPEG, PNG, WebP or AVIF up to {MAX_UPLOAD_BYTES / 1024 / 1024} MB. Images
        are re-encoded to WebP and stripped of EXIF metadata on upload. With no
        photography, the generated technical drawing is used.
      </p>

      {error && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-[12.5px] text-danger">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}
