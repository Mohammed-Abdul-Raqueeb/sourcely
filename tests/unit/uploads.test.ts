import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { sniffFormat, validateImageUpload } from '@/server/uploads/validate'
import { isValidKey, keyFromUrl, mediaUrl } from '@/server/uploads/storage'
import { MAX_UPLOAD_BYTES } from '@/lib/uploads'

let workDir = ''

beforeAll(async () => {
  workDir = await mkdtemp(path.join(tmpdir(), 'sourcely-uploads-'))
  process.env.UPLOAD_DIR = workDir
})

afterAll(async () => {
  if (workDir) await rm(workDir, { recursive: true, force: true })
})

/** A real encoded image, not a fixture of made-up bytes. */
async function image(
  format: 'jpeg' | 'png' | 'webp',
  width = 40,
  height = 30
): Promise<Buffer> {
  const base = sharp({
    create: { width, height, channels: 3, background: { r: 180, g: 90, b: 20 } },
  })
  return format === 'jpeg'
    ? base.jpeg().toBuffer()
    : format === 'png'
      ? base.png().toBuffer()
      : base.webp().toBuffer()
}

function upload(bytes: Buffer | Uint8Array, name: string, type: string): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

describe('format sniffing', () => {
  it('identifies each accepted raster format from its own bytes', async () => {
    expect(sniffFormat(await image('jpeg'))).toBe('jpeg')
    expect(sniffFormat(await image('png'))).toBe('png')
    expect(sniffFormat(await image('webp'))).toBe('webp')
  })

  it('rejects SVG, whatever it is called', () => {
    // An SVG is an XML document that can carry <script>. Unlike a raster file
    // it cannot be made safe by re-encoding, so it must never be accepted.
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    expect(sniffFormat(svg)).toBeNull()
  })

  it('rejects a script wearing an image extension', () => {
    expect(sniffFormat(Buffer.from('<?php system($_GET["c"]); ?>'))).toBeNull()
    expect(sniffFormat(Buffer.from('#!/bin/sh\nrm -rf /'))).toBeNull()
  })

  it('rejects an empty or truncated header', () => {
    expect(sniffFormat(new Uint8Array())).toBeNull()
    expect(sniffFormat(new Uint8Array([0xff, 0xd8]))).toBeNull()
  })

  it('does not mistake a bare RIFF container for WebP', () => {
    // RIFF is also WAV and AVI. Only the WEBP marker at offset 8 decides.
    const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE')])
    expect(sniffFormat(wav)).toBeNull()
  })
})

describe('validateImageUpload', () => {
  it('accepts a real image and returns its bytes once', async () => {
    const result = await validateImageUpload(upload(await image('png'), 'valve.png', 'image/png'))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.format).toBe('png')
      expect(result.bytes.length).toBeGreaterThan(0)
    }
  })

  it('believes the bytes, not the declared content type', async () => {
    // The classic upload bypass: a script named .png and declared image/png.
    const result = await validateImageUpload(
      upload(Buffer.from('<?php echo 1; ?>'), 'photo.png', 'image/png')
    )
    expect(result.ok).toBe(false)
  })

  it('accepts a real image regardless of a wrong declared type', async () => {
    // The inverse: the declaration is simply not consulted either way.
    const result = await validateImageUpload(
      upload(await image('jpeg'), 'photo.txt', 'text/plain')
    )
    expect(result.ok).toBe(true)
  })

  it('rejects an empty file', async () => {
    const result = await validateImageUpload(upload(Buffer.alloc(0), 'x.png', 'image/png'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/empty/i)
  })

  it('rejects a file over the size cap', async () => {
    const oversized = Buffer.alloc(MAX_UPLOAD_BYTES + 1_024)
    // Give it a valid JPEG header so size is what rejects it, not sniffing.
    oversized.set([0xff, 0xd8, 0xff], 0)

    const result = await validateImageUpload(upload(oversized, 'big.jpg', 'image/jpeg'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/limit/i)
  })

  it('rejects anything that is not a file at all', async () => {
    expect((await validateImageUpload(null)).ok).toBe(false)
    expect((await validateImageUpload('/etc/passwd')).ok).toBe(false)
    expect((await validateImageUpload(undefined)).ok).toBe(false)
  })
})

describe('storeProductImage', () => {
  it('re-encodes to WebP whatever went in', async () => {
    const { storeProductImage } = await import('@/server/uploads')
    const result = await storeProductImage(
      upload(await image('jpeg', 200, 150), 'valve.jpg', 'image/jpeg'),
      'A ball valve'
    )

    expect(result.ok).toBe(true)
    expect(result.image?.url).toMatch(/^\/api\/media\/[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{36}\.webp$/)
    expect(result.image?.width).toBe(200)
    expect(result.image?.height).toBe(150)
    expect(result.image?.blurDataUrl).toMatch(/^data:image\/webp;base64,/)
  })

  it('strips metadata that came in with the file', async () => {
    // EXIF routinely carries GPS coordinates a supplier did not mean to
    // publish. Re-encoding from decoded pixels is what removes it.
    const withExif = await sharp({
      create: { width: 60, height: 40, channels: 3, background: '#888' },
    })
      .withExif({ IFD0: { Copyright: 'SECRET-STUDIO', Artist: 'someone' } })
      .jpeg()
      .toBuffer()

    const { storeProductImage } = await import('@/server/uploads')
    const { getUploadStorage, keyFromUrl: toKey } = await import('@/server/uploads/storage')

    const result = await storeProductImage(upload(withExif, 'p.jpg', 'image/jpeg'), 'x')
    expect(result.ok).toBe(true)

    const stored = await getUploadStorage().get(toKey(result.image!.url)!)
    expect(stored).not.toBeNull()
    expect(stored!.toString('latin1')).not.toContain('SECRET-STUDIO')

    const meta = await sharp(stored!).metadata()
    expect(meta.exif).toBeUndefined()
  })

  it('does not enlarge an image smaller than the target', async () => {
    const { storeProductImage } = await import('@/server/uploads')
    const result = await storeProductImage(
      upload(await image('png', 64, 48), 'small.png', 'image/png'),
      'small'
    )
    expect(result.image?.width).toBe(64)
  })

  it('scales a large image down to the long edge', async () => {
    const { storeProductImage } = await import('@/server/uploads')
    const result = await storeProductImage(
      upload(await image('jpeg', 3_000, 1_500), 'wide.jpg', 'image/jpeg'),
      'wide'
    )
    expect(result.image?.width).toBe(1_600)
    expect(result.image?.height).toBe(800)
  })

  it('gives identical bytes the same key rather than storing them twice', async () => {
    const { storeProductImage } = await import('@/server/uploads')
    const bytes = await image('png', 30, 30)

    const first = await storeProductImage(upload(bytes, 'a.png', 'image/png'), 'a')
    const second = await storeProductImage(upload(bytes, 'b.png', 'image/png'), 'b')

    expect(first.image?.url).toBe(second.image?.url)
  })

  it('reports a rejection rather than throwing', async () => {
    const { storeProductImage } = await import('@/server/uploads')
    const result = await storeProductImage(
      upload(Buffer.from('not an image at all'), 'x.png', 'image/png'),
      'x'
    )
    expect(result.ok).toBe(false)
    expect(result.reason).toBeTruthy()
  })
})

describe('storage keys', () => {
  it('accepts only the shape put() generates', () => {
    expect(isValidKey(`ab/cd/${'0'.repeat(36)}.webp`)).toBe(true)
    expect(isValidKey(`ab/cd/${'0'.repeat(36)}.jpg`)).toBe(true)
  })

  it('rejects traversal in every encoding a request might carry', () => {
    expect(isValidKey('../../../etc/passwd')).toBe(false)
    expect(isValidKey('ab/cd/../../../etc/passwd')).toBe(false)
    expect(isValidKey('..%2f..%2fetc%2fpasswd')).toBe(false)
    expect(isValidKey('/etc/passwd')).toBe(false)
    expect(isValidKey('ab/cd/x.webp .txt')).toBe(false)
  })

  it('rejects an executable extension however well-formed the rest is', () => {
    expect(isValidKey(`ab/cd/${'0'.repeat(36)}.svg`)).toBe(false)
    expect(isValidKey(`ab/cd/${'0'.repeat(36)}.php`)).toBe(false)
    expect(isValidKey(`ab/cd/${'0'.repeat(36)}.html`)).toBe(false)
  })

  it('round-trips a key through its URL', () => {
    const key = `de/ad/${'b'.repeat(36)}.webp`
    expect(keyFromUrl(mediaUrl(key))).toBe(key)
  })

  it('refuses to recognise a URL it did not produce', () => {
    // This is what stops an arbitrary remote URL being written into the
    // catalogue by a replayed form post.
    expect(keyFromUrl('https://evil.example/x.webp')).toBeNull()
    expect(keyFromUrl('/api/media/../../secret')).toBeNull()
    expect(keyFromUrl('javascript:alert(1)')).toBeNull()
  })
})

describe('storage round trip', () => {
  it('reads back exactly what was written', async () => {
    const { getUploadStorage } = await import('@/server/uploads/storage')
    const storage = getUploadStorage()
    const data = await image('webp')

    const stored = await storage.put(Buffer.from(data), 'webp')
    const read = await storage.get(stored.key)

    expect(read).not.toBeNull()
    expect(Buffer.compare(read!, Buffer.from(data))).toBe(0)
  })

  it('returns null for a well-formed key that names nothing', async () => {
    const { getUploadStorage } = await import('@/server/uploads/storage')
    expect(await getUploadStorage().get(`ff/ee/${'a'.repeat(36)}.webp`)).toBeNull()
  })

  it('returns null rather than reading outside the upload root', async () => {
    const { getUploadStorage } = await import('@/server/uploads/storage')
    expect(await getUploadStorage().get('../../../package.json')).toBeNull()
  })
})

describe('storage driver selection', () => {
  // Selection is read from the environment once and cached, so each case needs
  // a fresh module registry as well as its own environment.
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  async function fresh() {
    vi.resetModules()
    return import('@/server/uploads/storage')
  }

  it('defaults to the local driver with nothing configured', async () => {
    vi.stubEnv('UPLOAD_DRIVER', '')
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '')
    const storage = await fresh()
    expect(storage.resolveUploadDriver()).toBe('local')
    // The local driver has no public surface — the media route streams bytes.
    expect(storage.getUploadStorage().publicUrl).toBeUndefined()
  })

  it('selects blob when the token is present', async () => {
    vi.stubEnv('UPLOAD_DRIVER', '')
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_test_0000')
    const storage = await fresh()
    expect(storage.resolveUploadDriver()).toBe('blob')
    expect(typeof storage.getUploadStorage().publicUrl).toBe('function')
  })

  it('lets an explicit UPLOAD_DRIVER=local override a configured token', async () => {
    vi.stubEnv('UPLOAD_DRIVER', 'local')
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_test_0000')
    const storage = await fresh()
    expect(storage.resolveUploadDriver()).toBe('local')
  })

  it('refuses UPLOAD_DRIVER=blob without a token, naming the variable', async () => {
    vi.stubEnv('UPLOAD_DRIVER', 'blob')
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '')
    const storage = await fresh()
    expect(() => storage.getUploadStorage()).toThrow(/BLOB_READ_WRITE_TOKEN/)
  })

  it('refuses the local driver on Vercel, where the filesystem is ephemeral', async () => {
    vi.stubEnv('UPLOAD_DRIVER', '')
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '')
    vi.stubEnv('VERCEL', '1')
    const storage = await fresh()
    expect(() => storage.getUploadStorage()).toThrow(/ephemeral/)
  })
})
