import { describe, expect, it } from 'vitest'
import { csvResponse, exportFilename, toCsv, type CsvColumn } from '@/server/export/csv'

interface Row {
  name: string
  price: number
  note: string | null
}

const columns: CsvColumn<Row>[] = [
  { header: 'Name', value: (r) => r.name },
  { header: 'Price', value: (r) => r.price },
  { header: 'Note', value: (r) => r.note },
]

/** The BOM is deliberate; strip it so assertions read naturally. */
const body = (csv: string) => csv.replace(/^﻿/, '')
const lines = (csv: string) => body(csv).trimEnd().split('\r\n')

describe('toCsv', () => {
  it('writes a header row followed by one row per record', () => {
    const csv = toCsv(
      [
        { name: 'Ball valve', price: 3240, note: null },
        { name: 'Gate valve', price: 5100, note: 'urgent' },
      ],
      columns
    )

    expect(lines(csv)).toEqual([
      'Name,Price,Note',
      'Ball valve,3240,',
      'Gate valve,5100,urgent',
    ])
  })

  it('writes numbers unformatted so a spreadsheet can compute on them', () => {
    const csv = toCsv([{ name: 'x', price: 1234567, note: null }], columns)
    expect(body(csv)).toContain(',1234567,')
    expect(body(csv)).not.toContain('12,34,567')
  })

  it('starts with a UTF-8 BOM so Excel does not mangle non-ASCII', () => {
    // Without it, "₹" and any Devanagari arrive as mojibake in Excel.
    const csv = toCsv([{ name: 'Vantek ₹ valve', price: 1, note: null }], columns)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('₹')
  })

  it('uses CRLF line endings, as RFC 4180 specifies', () => {
    const csv = toCsv([{ name: 'a', price: 1, note: null }], columns)
    expect(csv).toContain('\r\n')
    expect(body(csv).replace(/\r\n/g, '')).not.toContain('\n')
  })

  it('quotes fields containing a comma, a quote or a newline', () => {
    const csv = toCsv(
      [{ name: 'Valve, 2-piece', price: 1, note: 'He said "fine"\nnext line' }],
      columns
    )
    expect(body(csv)).toContain('"Valve, 2-piece"')
    expect(body(csv)).toContain('"He said ""fine""')
  })

  it('renders null and undefined as empty, not as the word', () => {
    const csv = toCsv([{ name: 'x', price: 0, note: null }], columns)
    expect(body(csv)).not.toContain('null')
    expect(body(csv)).not.toContain('undefined')
    expect(lines(csv)[1]).toBe('x,0,')
  })

  it('emits a header-only file for no rows rather than an empty one', () => {
    // An empty file reads as a failed export; a header row reads as no data.
    expect(lines(toCsv([], columns))).toEqual(['Name,Price,Note'])
  })

  describe('formula injection', () => {
    /**
     * Excel evaluates any cell beginning `=`, `+`, `-` or `@`. A product name
     * an admin can type therefore becomes executable in whoever opens the
     * export — the CSV equivalent of stored XSS.
     */
    const dangerous = [
      '=HYPERLINK("http://attacker.example","click")',
      '+1+1',
      '-2+3',
      '@SUM(A1:A9)',
      '=cmd|\' /c calc\'!A1',
    ]

    // A single-column table, so the data row *is* the cell and the assertion
    // does not have to re-implement field splitting to find it.
    const nameOnly: CsvColumn<Row>[] = [{ header: 'Name', value: (r) => r.name }]

    for (const payload of dangerous) {
      it(`neutralises ${payload.slice(0, 12)}…`, () => {
        const cell = lines(toCsv([{ name: payload, price: 1, note: null }], nameOnly))[1]!

        // No cell may begin with a character Excel treats as a formula.
        expect(/^[=+\-@]/.test(cell)).toBe(false)

        // The text itself survives, so the export stays readable. Compared
        // after undoing CSV quote-doubling, which is a separate escaping layer.
        const unescaped = cell.startsWith('"')
          ? cell.slice(1, -1).replace(/""/g, '"')
          : cell
        expect(unescaped).toBe(`	${payload}`)
      })
    }

    it('leaves an ordinary negative number readable', () => {
      // The guard also catches legitimate values; that is the accepted cost,
      // and the value must still be present and recognisable.
      const csv = toCsv([{ name: 'x', price: -50, note: null }], columns)
      expect(body(csv)).toContain('50')
    })
  })
})

describe('csvResponse', () => {
  it('sets the headers a browser needs to download rather than render', () => {
    const response = csvResponse('a,b\r\n', 'sourcely-products-2026-08-23.csv')

    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(response.headers.get('Content-Disposition')).toContain('attachment')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('marks the response uncacheable', () => {
    // These files carry commercial data; a shared cache must not keep a copy.
    const cache = csvResponse('a\r\n', 'x.csv').headers.get('Cache-Control')
    expect(cache).toContain('no-store')
    expect(cache).toContain('private')
  })

  it('sanitises a filename so it cannot break out of the header', () => {
    const response = csvResponse('a\r\n', 'evil"; drop=1; x="y.csv')
    const disposition = response.headers.get('Content-Disposition')!

    // Exactly one quoted filename parameter — no injected second one.
    expect(disposition.match(/filename="/g)).toHaveLength(1)
    expect(disposition).not.toContain('drop=1;')
  })
})

describe('exportFilename', () => {
  it('carries the kind and the date', () => {
    expect(exportFilename('products', new Date('2026-08-23T10:00:00Z'))).toBe(
      'sourcely-products-2026-08-23.csv'
    )
  })
})
