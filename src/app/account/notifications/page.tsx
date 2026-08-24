import type { Metadata } from 'next'
import { requireUser } from '@/server/auth/session'
import { getActivityRepository } from '@/server/repositories'
import { pluralize } from '@/lib/format'
import { StateBlock } from '@/components/ui/states'
import { PageHeader, SectionCard } from '@/components/account/ui'
import { MarkAllReadButton, NotificationRow } from '@/components/account/actions'

export const metadata: Metadata = { title: 'Notifications' }

export default async function NotificationsPage() {
  const user = await requireUser('/account/notifications')

  const activity = getActivityRepository()
  const [notifications, unread] = await Promise.all([
    activity.listNotifications(user.id, 50),
    activity.unreadCount(user.id),
  ])

  return (
    <>
      <PageHeader
        title="Notifications"
        description={
          notifications.length > 0
            ? unread > 0
              ? `${pluralize(unread, 'unread notification')}`
              : 'You are all caught up.'
            : 'Quotation updates, stock changes and saved-search matches arrive here.'
        }
        action={<MarkAllReadButton unread={unread} />}
      />

      {notifications.length === 0 ? (
        <StateBlock
          title="Nothing to report"
          description="When a supplier responds to a quotation request, or a product you saved comes back into stock, you will hear about it here."
          primaryAction={{ label: 'Browse products', href: '/products' }}
        />
      ) : (
        <SectionCard title="All notifications" padded={false}>
          <ul className="divide-y divide-border">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <NotificationRow notification={notification} />
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </>
  )
}
