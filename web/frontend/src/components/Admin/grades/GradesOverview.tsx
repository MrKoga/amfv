import { type ReactNode, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import ClaimColoredText from "./ClaimColoredText"
import { MetricInfo, Ratio, ReviewChip } from "./chips"
import {
  claimColorOwners,
  type GradesModel,
  percent,
  type TaskSummary,
} from "./gradesModel"

type Filter = "all" | "disagree" | "split" | "flagged" | "added" | "unreviewed"

/** The explanation behind both "Humans disagree with humans" numbers. */
function HumansVsHumansInfo() {
  return (
    <MetricInfo title="Humans disagree with humans on claim grade">
      <ul className="list-disc space-y-2 pl-5 text-sm">
        <li>
          Only model claims that two or more reviewers graded count. A claim
          with one reviewer is skipped, because there is nobody for that
          reviewer to disagree with.
        </li>
        <li>
          Every grade given on those claims is counted. That is the second
          number.
        </li>
        <li>
          On each claim, the most common grade is the majority. Every other
          grade on that claim counts as a disagreement. Those add up to the
          first number.
        </li>
        <li>
          Examples: vital, vital, unimportant scores 1 of 3. Vital,
          semi-important, unimportant scores 2 of 3. Vital and semi-important
          from two reviewers scores 1 of 2.
        </li>
        <li>
          The model's grade is not part of this. Neither are the review buttons;
          those are counted under review issues.
        </li>
      </ul>
    </MetricInfo>
  )
}

function StatTile({
  label,
  value,
  details,
}: {
  label: ReactNode
  value?: string
  details: ReactNode[]
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border p-4">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {value ? (
        <span className="text-2xl font-semibold leading-none">{value}</span>
      ) : null}
      <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground text-xs">
        {details.map((detail, index) => (
          <li key={index}>{detail}</li>
        ))}
      </ul>
    </div>
  )
}

function matchesFilter(task: TaskSummary, filter: Filter): boolean {
  switch (filter) {
    case "disagree":
      return task.disagreeCount > 0
    case "split":
      return task.splitCount > 0
    case "flagged":
      return task.flaggedReviews > 0
    case "added":
      return task.addedCount > 0
    case "unreviewed":
      return task.status === "unreviewed"
    default:
      return true
  }
}

export default function GradesOverview({
  model,
  onOpenTask,
}: {
  model: GradesModel
  onOpenTask: (caseId: string) => void
}) {
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")
  const { totals } = model

  const counts: Record<Filter, number> = {
    all: model.tasks.length,
    disagree: model.tasks.filter((t) => t.disagreeCount > 0).length,
    split: model.tasks.filter((t) => t.splitCount > 0).length,
    flagged: model.tasks.filter((t) => t.flaggedReviews > 0).length,
    added: model.tasks.filter((t) => t.addedCount > 0).length,
    unreviewed: model.tasks.filter((t) => t.status === "unreviewed").length,
  }
  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All tasks" },
    { key: "disagree", label: "Humans disagree with model" },
    { key: "split", label: "Humans disagree with humans" },
    { key: "flagged", label: "Human review issues" },
    { key: "added", label: "Human added claims" },
    { key: "unreviewed", label: "Unreviewed" },
  ]

  const needle = search.trim().toLowerCase()
  const visibleTasks = model.tasks.filter(
    (task) =>
      matchesFilter(task, filter) &&
      (needle === "" ||
        task.caseId.toLowerCase().includes(needle) ||
        (task.question ?? "").toLowerCase().includes(needle) ||
        task.response.toLowerCase().includes(needle) ||
        task.claims.some((claim) =>
          claim.claim.toLowerCase().includes(needle),
        )),
  )

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatTile
          details={[
            <>
              {totals.reviewed} of {totals.tasks}{" "}
              <strong className="font-semibold">TASKS</strong> reviewed
              {totals.unreviewed === 0
                ? ""
                : `, ${totals.unreviewed} with no review yet`}
            </>,
            <>
              {totals.judged} of {totals.claims}{" "}
              <strong className="font-semibold">CLAIMS</strong> (model claims)
              reviewed
            </>,
            <>
              {totals.judgments}{" "}
              <strong className="font-semibold">CLAIMS ASSESSED</strong> (one
              per reviewer per reviewed claim)
            </>,
          ]}
          label="Totals"
        />
        <StatTile
          details={[
            <>
              {totals.changed} of {totals.judgments} assessed claim{" "}
              <strong className="font-semibold">GRADES</strong> differ from the
              model
            </>,
            <>
              {totals.disagreements} of {totals.judged} graded model claims had
              at least one grade changed
            </>,
          ]}
          label="Humans disagree with model on grade"
          value={percent(totals.changed, totals.judgments)}
        />
        <StatTile
          details={[
            <>
              {totals.minorityGrades} of {totals.multiGradedGrades} assessed
              claim <strong className="font-semibold">GRADES</strong> differ
              from the most common grade on their claim
            </>,
            <>
              {totals.reviewerSplits} of {totals.multiGraded} claims graded by
              two or more people got more than one grade
            </>,
          ]}
          label={
            <>
              Humans disagree with humans on grade
              <HumansVsHumansInfo />
            </>
          }
          value={percent(totals.minorityGrades, totals.multiGradedGrades)}
        />
        <StatTile
          details={[
            <>
              {totals.flaggedReviews} of {totals.judgments} assessed claim{" "}
              <strong className="font-semibold">REVIEWS</strong> had a review
              issue
              <ul className="mt-1 list-[circle] space-y-1 pl-4">
                <li>{totals.issues} Extraction issue</li>
                <li>{totals.duplicates} Duplicate</li>
                <li>{totals.multipleFacts} Multiple facts</li>
              </ul>
            </>,
            <>
              {totals.flaggedClaims} of {totals.judged} graded model claims got
              at least one
            </>,
          ]}
          label="Human review issues"
          value={percent(totals.flaggedReviews, totals.judgments)}
        />
        <StatTile
          details={[
            <>
              {totals.splits} are{" "}
              <ReviewChip small>Split into atoms</ReviewChip>
            </>,
          ]}
          label="Claims added by reviewers"
          value={String(totals.added)}
        />
      </section>

      <section className="flex flex-wrap items-center gap-2">
        {filters.map((entry) => (
          <Button
            aria-pressed={filter === entry.key}
            key={entry.key}
            onClick={() => setFilter(entry.key)}
            size="sm"
            type="button"
            variant={filter === entry.key ? "default" : "outline"}
          >
            {entry.label} · {counts[entry.key]}
          </Button>
        ))}
        <div className="flex-1" />
        <label className="sr-only" htmlFor="grades-search">
          Search tasks
        </label>
        <Input
          className="h-8 w-64"
          id="grades-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search question or claim text"
          type="search"
          value={search}
        />
      </section>

      <section className="overflow-x-auto rounded-md border">
        <Table>
          {/* Header labels may wrap to two lines so the number columns stay narrow. */}
          <TableHeader className="[&_th]:h-auto [&_th]:py-3 [&_th]:align-top [&_th]:leading-tight [&_th]:whitespace-normal">
            <TableRow>
              <TableHead className="w-14 text-right">Task</TableHead>
              <TableHead className="w-32">Case</TableHead>
              <TableHead className="min-w-[180px]">Question</TableHead>
              <TableHead className="min-w-[200px]">Source text</TableHead>
              <TableHead className="w-16 text-right">Model claims</TableHead>
              <TableHead className="w-20 text-right">Reviewers</TableHead>
              <TableHead className="w-28">
                Humans disagree with model on claim grade
              </TableHead>
              <TableHead className="w-28">
                Humans disagree with humans on claim grade
                <HumansVsHumansInfo />
              </TableHead>
              <TableHead className="w-24">
                Humans flagged a review issue
              </TableHead>
              <TableHead className="w-20 text-right">
                Human added claims
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleTasks.map((task) => (
              <TableRow
                className={cn(
                  "hover:bg-transparent [&>td]:py-4 [&>td]:align-top",
                  task.disagreeCount > 0 &&
                    "bg-amber-50/60 hover:bg-amber-50/60 dark:bg-amber-950/25 dark:hover:bg-amber-950/25",
                )}
                key={task.caseId}
              >
                <TableCell className="text-right font-mono">
                  {task.taskId ?? "—"}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  <Button
                    className="h-auto p-0 font-mono text-xs"
                    onClick={() => onOpenTask(task.caseId)}
                    type="button"
                    variant="link"
                  >
                    {task.caseId}
                  </Button>
                </TableCell>
                <TableCell className="whitespace-pre-line text-muted-foreground">
                  {task.question ?? "—"}
                </TableCell>
                <TableCell className="whitespace-pre-line text-xs text-muted-foreground">
                  <ClaimColoredText
                    className="block leading-8"
                    owners={claimColorOwners(task)}
                    text={task.response}
                  />
                </TableCell>
                <TableCell className="text-right font-mono">
                  {task.claims.length}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {task.reviewerIds.length}
                </TableCell>
                <TableCell>
                  {task.judgments > 0 ? (
                    <Ratio part={task.changedGrades} whole={task.judgments} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {task.multiGradedGrades > 0 ? (
                    <Ratio
                      part={task.minorityGrades}
                      whole={task.multiGradedGrades}
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {task.judgments > 0 ? (
                    <Ratio part={task.flaggedReviews} whole={task.judgments} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {task.addedCount}
                </TableCell>
              </TableRow>
            ))}
            {visibleTasks.length === 0 ? (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={10}>
                  No tasks match this filter.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
