"use client"

import {
  IconBrandWhatsapp,
  IconCheck,
  IconListCheck,
  IconPhone,
  IconTrendingDown,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { telUrl, whatsappUrl } from "@/lib/contact"
import { addDays, monthName, nairaShort } from "@/lib/format"
import { useCreateTask, useCustomers, useReferralAsked } from "@/lib/queries"
import { PRODUCT_LABEL, type Prospect } from "@/lib/types"
import { EmptyNote, PageHeader, PageSection } from "@/components/section"
import { useOpenProspect } from "@/components/prospect-sheet"
import { useQuickLogDialog } from "@/components/quick-log"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export default function CustomersPage() {
  const { data, isError } = useCustomers()

  return (
    <>
      <PageHeader
        title="Customers"
        description="Keeping funded customers close: who to call about a balance drop, who's due a check-in, who to ask for a referral, and what to offer next."
      />
      {isError ? (
        <EmptyNote>
          Couldn&apos;t load your customers. Refresh to try again.
        </EmptyNote>
      ) : !data ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          <PageSection
            title="Balances down"
            count={data.drops.length}
            hint="Fell by a fifth or more since the month before. Call to find out why."
          >
            {data.drops.length ? (
              <ul className="divide-y rounded-xl border bg-card">
                {data.drops.map((d) => (
                  <Row
                    key={d.prospectId}
                    prospect={d.prospect}
                    detail={
                      <span className="flex items-center gap-1 text-destructive">
                        <IconTrendingDown className="size-3.5" aria-hidden />
                        {nairaShort(d.from)} → {nairaShort(d.to)} in{" "}
                        {monthName(d.month)}
                      </span>
                    }
                  >
                    <LogButton prospect={d.prospect} />
                  </Row>
                ))}
              </ul>
            ) : (
              <EmptyNote>No sharp drops in the latest balances.</EmptyNote>
            )}
          </PageSection>

          <PageSection
            title="Due a check-in"
            count={data.checkIns.length}
            hint="Nothing booked, and longer than their tier's interval since you spoke (A every 2 weeks, B monthly, C quarterly)."
          >
            {data.checkIns.length ? (
              <ul className="divide-y rounded-xl border bg-card">
                {data.checkIns.map((p) => (
                  <Row
                    key={p.id}
                    prospect={p}
                    detail={`Last contact ${p.daysSinceContact} days ago · every ${p.careDays} days`}
                  >
                    <LogButton prospect={p} />
                  </Row>
                ))}
              </ul>
            ) : (
              <EmptyNote>Everyone&apos;s been looked after recently.</EmptyNote>
            )}
          </PageSection>

          <PageSection
            title="Ask for a referral"
            count={data.referralAsks.length}
            hint="Funded a month or more and not asked yet. Happy customers are the best source of new ones."
          >
            {data.referralAsks.length ? (
              <ul className="divide-y rounded-xl border bg-card">
                {data.referralAsks.map((p) => (
                  <Row
                    key={p.id}
                    prospect={p}
                    detail={`Funded ${p.fundedDays} days ago${p.referrals ? ` · ${p.referrals} referred so far` : ""}`}
                  >
                    {p.phone && (
                      <Button
                        size="xs"
                        variant="outline"
                        nativeButton={false}
                        render={
                          <a
                            href={`${whatsappUrl(p.phone)}?text=${encodeURIComponent(
                              `Hi ${p.name.split(" ")[0]}, thank you for banking with us. If you know anyone who'd like the same service, I'd be glad to look after them too.`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                          />
                        }
                      >
                        <IconBrandWhatsapp data-icon="inline-start" /> Ask
                      </Button>
                    )}
                    <AskedButton id={p.id} name={p.name} />
                  </Row>
                ))}
              </ul>
            ) : (
              <EmptyNote>No one to ask right now.</EmptyNote>
            )}
          </PageSection>

          <PageSection
            title="Offer next"
            count={data.crossSell.length}
            hint="Products they don't hold yet. Adding a to-do takes it off this list."
          >
            {data.crossSell.length ? (
              <ul className="divide-y rounded-xl border bg-card">
                {data.crossSell.map((i) => (
                  <Row
                    key={`${i.prospect.id}:${i.product}`}
                    prospect={i.prospect}
                    detail={
                      <>
                        <span className="font-medium text-foreground">
                          {PRODUCT_LABEL[i.product]}
                        </span>{" "}
                        · {i.reason}
                      </>
                    }
                  >
                    <OfferButton
                      prospect={i.prospect}
                      product={i.product}
                      today={data.today}
                    />
                  </Row>
                ))}
              </ul>
            ) : (
              <EmptyNote>Nothing to suggest right now.</EmptyNote>
            )}
          </PageSection>
        </>
      )}
    </>
  )
}

function Row({
  prospect,
  detail,
  children,
}: {
  prospect: Prospect
  detail: React.ReactNode
  children: React.ReactNode
}) {
  const open = useOpenProspect()
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => open(prospect.id)}
      >
        <span className="block truncate text-sm font-medium hover:underline">
          {prospect.name}
          {prospect.funded ? (
            <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">
              {nairaShort(prospect.funded)}
            </span>
          ) : null}
        </span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </button>
      <div className="flex shrink-0 gap-1.5">{children}</div>
    </li>
  )
}

function LogButton({ prospect }: { prospect: Prospect }) {
  const open = useQuickLogDialog()
  return (
    <>
      {prospect.phone && (
        <Button
          size="xs"
          variant="outline"
          nativeButton={false}
          render={<a href={telUrl(prospect.phone)} />}
          aria-label={`Call ${prospect.name}`}
        >
          <IconPhone />
        </Button>
      )}
      <Button size="xs" onClick={() => open(prospect)}>
        Log contact
      </Button>
    </>
  )
}

function AskedButton({ id, name }: { id: string; name: string }) {
  const asked = useReferralAsked()
  return (
    <Button
      size="xs"
      disabled={asked.isPending}
      onClick={() =>
        asked.mutate(
          { id, asked: true },
          {
            onSuccess: () =>
              toast.success(`Marked ${name} as asked`, {
                action: {
                  label: "Undo",
                  onClick: () => asked.mutate({ id, asked: false }),
                },
              }),
          }
        )
      }
    >
      <IconCheck data-icon="inline-start" /> Asked
    </Button>
  )
}

function OfferButton({
  prospect,
  product,
  today,
}: {
  prospect: Prospect
  product: keyof typeof PRODUCT_LABEL
  today: string
}) {
  const create = useCreateTask()
  return (
    <Button
      size="xs"
      variant="outline"
      disabled={create.isPending}
      onClick={() =>
        create.mutate(
          {
            id: crypto.randomUUID(),
            title: `Offer ${PRODUCT_LABEL[product]} to ${prospect.name}`,
            dueDate: addDays(today, 7),
            prospectId: prospect.id,
            source: `cross-sell:${prospect.id}:${product}`,
          },
          { onSuccess: () => toast.success("Added to your to-dos") }
        )
      }
    >
      <IconListCheck data-icon="inline-start" /> Add to-do
    </Button>
  )
}
