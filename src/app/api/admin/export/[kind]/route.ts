import type { NextRequest } from 'next/server'
import { requireRoleForApi } from '@/server/auth/session'
import { getAdminRepository, getCatalogRepository } from '@/server/repositories'
import { recordAudit } from '@/server/audit/record'
import { csvResponse, exportFilename } from '@/server/export/csv'
import {
  customersCsv,
  isExportKind,
  productsCsv,
  quotationsCsv,
  searchesCsv,
  type ExportKind,
} from '@/server/export/reports'

/**
 * Admin CSV exports.
 *
 * A route handler rather than a server action because the response is a file:
 * an action returns serialised data to the client, which would then have to
 * build a blob and synthesise a download. A GET with Content-Disposition is
 * what browsers already know how to do.
 *
 * Three things this must get right, and each has bitten a real system:
 *
 *   - It is a *download*, so it is reached by plain navigation with no CSRF
 *     token. That is safe only because it is read-only and role-guarded; never
 *     add a mutation here.
 *   - Every export is audited. A CSV of every customer's contact details
 *     leaving the building is exactly the event an audit trail exists for.
 *   - Rows are capped. An unbounded export is a way to turn one request into
 *     an out-of-memory kill.
 */

export const dynamic = 'force-dynamic'

/** Upper bound per export. Beyond this the answer is a database job, not a URL. */
const ROW_CAP = 20_000

async function build(kind: ExportKind): Promise<{ csv: string; rows: number }> {
  const catalog = getCatalogRepository()
  const admin = getAdminRepository()

  switch (kind) {
    case 'products': {
      // listAll includes archived products deliberately — an export used for
      // reconciliation that silently omitted them would not reconcile.
      const [products, categories, brands, sellers] = await Promise.all([
        catalog.listAll(),
        catalog.categories(),
        catalog.brands(),
        catalog.sellers(),
      ])
      const capped = products.slice(0, ROW_CAP)
      return {
        csv: productsCsv(capped, { categories, brands, sellers }),
        rows: capped.length,
      }
    }

    case 'quotations': {
      const rfqs = (await admin.listAllRfqs(ROW_CAP)).slice(0, ROW_CAP)

      const ids = [...new Set(rfqs.flatMap((rfq) => rfq.items.map((item) => item.productId)))]
      const products = await catalog.findManyByIds(ids)
      const names = new Map(products.map((product) => [product.id, product.name]))

      return { csv: quotationsCsv(rfqs, names), rows: rfqs.length }
    }

    case 'searches': {
      const events = (await admin.listAllSearchEvents(ROW_CAP)).slice(0, ROW_CAP)
      return { csv: searchesCsv(events), rows: events.length }
    }

    case 'customers': {
      const users = (await admin.listUsers(ROW_CAP)).slice(0, ROW_CAP)
      return { csv: customersCsv(users), rows: users.length }
    }
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ kind: string }> }
) {
  const { kind } = await params

  if (!isExportKind(kind)) {
    return new Response('Unknown export', { status: 404 })
  }

  // Customer contact details are a step above catalogue data; only a full
  // admin may take a copy of them.
  const required = kind === 'customers' ? 'admin' : 'staff'
  const user = await requireRoleForApi(required)

  // 404 rather than 403, matching the page guards: a customer probing this URL
  // learns nothing about what exists behind it.
  if (!user) return new Response('Not found', { status: 404 })

  const { csv, rows } = await build(kind)

  await recordAudit({
    action: 'export',
    targetType: 'export',
    targetId: kind,
    summary: `${user.email} exported ${rows} ${kind} row${rows === 1 ? '' : 's'}`,
  })

  return csvResponse(csv, exportFilename(kind))
}
