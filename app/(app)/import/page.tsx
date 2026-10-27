"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import Papa from "papaparse"
import { toast } from "sonner"
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconDownload,
  IconFileSpreadsheet,
  IconUpload,
} from "@tabler/icons-react"
import {
  IMPORT_FIELDS,
  buildRows,
  guessMapping,
  type ImportField,
} from "@/lib/import"
import { useImportProspects, type ImportResult } from "@/lib/queries"
import { STAGE_LABEL } from "@/lib/types"
import { naira } from "@/lib/format"
import { PageHeader, PageSection } from "@/components/section"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

const MAX_ROWS = 2000
const PREVIEW = 6

interface Sheet {
  file: string
  cells: unknown[][]
}

async function readFile(file: File): Promise<unknown[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { default: readXlsxFile } = await import("read-excel-file")
    return (await readXlsxFile(file)) as unknown[][]
  }
  if (/\.xls$/i.test(file.name))
    throw new Error(
      "Old .xls files can’t be read. In Excel, Save As .xlsx or CSV first."
    )
  const text = await file.text()
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), {
    skipEmptyLines: "greedy",
  })
  return parsed.data
}

export default function ImportPage() {
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  return (
    <>
      <PageHeader
        title="Import and export"
        description="Bring prospects in from a spreadsheet, or take a copy of everything."
      />
      {result ? (
        <Done
          result={result}
          onAgain={() => {
            setResult(null)
            setSheet(null)
          }}
        />
      ) : sheet ? (
        <Mapper
          sheet={sheet}
          onCancel={() => setSheet(null)}
          onDone={setResult}
        />
      ) : (
        <Upload onLoaded={setSheet} />
      )}
      <Export />
    </>
  )
}

function Upload({ onLoaded }: { onLoaded: (s: Sheet) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)

  async function load(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      const cells = await readFile(file)
      if (cells.length < 1) throw new Error("That file is empty.")
      onLoaded({ file: file.name, cells })
    } catch (e) {
      toast.error((e as Error).message || "We couldn’t read that file.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageSection title="Import">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          load(e.dataTransfer.files[0])
        }}
        className={`grid place-items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${dragging ? "border-primary bg-primary/5" : "bg-card"}`}
      >
        <IconFileSpreadsheet className="size-10 text-muted-foreground" />
        <div>
          <p className="font-medium">Drop a CSV or Excel (.xlsx) file here</p>
          <p className="mt-1 text-sm text-muted-foreground">
            One row per prospect, with a header row. You&apos;ll match the
            columns next. Up to {MAX_ROWS.toLocaleString()} rows at a time.
          </p>
        </div>
        <Button onClick={() => input.current?.click()} disabled={busy}>
          <IconUpload data-icon="inline-start" />
          {busy ? "Reading…" : "Choose file"}
        </Button>
        <input
          ref={input}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv"
          className="sr-only"
          onChange={(e) => load(e.target.files?.[0])}
        />
        <p className="text-xs text-muted-foreground">
          The file is read on this device; only the matched columns are sent.
          Duplicates (same phone, email or name) are skipped.
        </p>
      </div>
    </PageSection>
  )
}

function Mapper({
  sheet,
  onCancel,
  onDone,
}: {
  sheet: Sheet
  onCancel: () => void
  onDone: (r: ImportResult) => void
}) {
  const [hasHeader, setHasHeader] = useState(true)
  const width = Math.max(...sheet.cells.slice(0, 50).map((r) => r.length))
  const headers = hasHeader
    ? Array.from({ length: width }, (_, i) => String(sheet.cells[0]?.[i] ?? ""))
    : Array.from({ length: width }, (_, i) => `Column ${i + 1}`)
  const [mapping, setMapping] = useState<(ImportField | "")[]>(() =>
    guessMapping(headers)
  )
  const importRows = useImportProspects()

  const body = hasHeader ? sheet.cells.slice(1) : sheet.cells
  const { ok, noName } = useMemo(
    () => buildRows(body, mapping, hasHeader ? 2 : 1),
    [body, mapping, hasHeader]
  )
  const withDrops = ok.filter((r) => r.dropped.length)
  const nameMapped = mapping.includes("name")

  function setField(col: number, field: ImportField | "") {
    // A field can only come from one column (except notes, which are joined).
    setMapping((m) =>
      m.map((f, i) =>
        i === col ? field : field && field !== "notes" && f === field ? "" : f
      )
    )
  }

  async function run() {
    try {
      let created = 0
      const skipped: ImportResult["skipped"] = []
      for (let i = 0; i < ok.length; i += MAX_ROWS) {
        const batch = ok.slice(i, i + MAX_ROWS)
        const r = await importRows.mutateAsync(batch.map((b) => b.input))
        created += r.created
        // The API numbers rows within the batch; show spreadsheet rows instead.
        skipped.push(
          ...r.skipped.map((s) => ({ ...s, row: batch[s.row - 1].row }))
        )
      }
      onDone({ created, skipped })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <PageSection
      title={`Match columns: ${sheet.file}`}
      hint="Check what each column holds. Columns set to Skip aren't imported."
    >
      <div className="rounded-xl border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Checkbox
            id="has-header"
            checked={hasHeader}
            onCheckedChange={(v) => {
              setHasHeader(!!v)
              setMapping(
                guessMapping(
                  v
                    ? Array.from({ length: width }, (_, i) =>
                        String(sheet.cells[0]?.[i] ?? "")
                      )
                    : []
                )
                  .concat(Array(width).fill(""))
                  .slice(0, width)
              )
            }}
          />
          <Label htmlFor="has-header">The first row is column names</Label>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {headers.map((h, i) => (
            <div key={i} className="grid gap-1 rounded-lg border p-2.5">
              <Label
                htmlFor={`col-${i}`}
                className="truncate text-xs text-muted-foreground"
              >
                {h || `Column ${i + 1}`}
                <span className="ml-1 font-normal">
                  e.g.{" "}
                  {String(
                    body.find((r) => r[i] != null && String(r[i]).trim())?.[
                      i
                    ] ?? "—"
                  ).slice(0, 40)}
                </span>
              </Label>
              <NativeSelect
                id={`col-${i}`}
                value={mapping[i] ?? ""}
                onChange={(e) =>
                  setField(i, e.target.value as ImportField | "")
                }
              >
                <NativeSelectOption value="">Skip</NativeSelectOption>
                {IMPORT_FIELDS.map(([f, label]) => (
                  <NativeSelectOption key={f} value={f}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          ))}
        </div>
      </div>

      {nameMapped ? (
        <>
          <h3 className="mt-6 text-sm font-semibold">
            Preview ({ok.length.toLocaleString()} prospect
            {ok.length === 1 ? "" : "s"})
          </h3>
          <div className="mt-2 overflow-x-auto rounded-xl border bg-card shadow-xs">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Company</th>
                  <th className="px-3 py-2 text-left font-medium">Phone</th>
                  <th className="px-3 py-2 text-left font-medium">Stage</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Potential
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ok.slice(0, PREVIEW).map((r) => (
                  <tr key={r.row}>
                    <td className="px-3 py-2 font-medium">{r.input.name}</td>
                    <td className="px-3 py-2">{r.input.company ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.input.phone ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {STAGE_LABEL[r.input.stage ?? "IDENTIFIED"]}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.input.potential ? naira(r.input.potential) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(withDrops.length > 0 || noName.length > 0) && (
            <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <IconAlertTriangle className="size-4" /> Some values will be
                left out
              </p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-muted-foreground">
                {noName.length > 0 && (
                  <li>
                    {noName.length} row{noName.length === 1 ? " has" : "s have"}{" "}
                    no name and will be skipped (row{" "}
                    {noName.slice(0, 5).join(", ")}
                    {noName.length > 5 ? "…" : ""}).
                  </li>
                )}
                {withDrops.slice(0, 5).map((r) => (
                  <li key={r.row}>
                    Row {r.row}: {r.dropped.join(", ")} not recognised
                  </li>
                ))}
                {withDrops.length > 5 && (
                  <li>…and {withDrops.length - 5} more rows</li>
                )}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Choose which column holds the prospect&apos;s name to continue.
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Choose another file
        </Button>
        <Button
          onClick={run}
          disabled={!nameMapped || !ok.length || importRows.isPending}
        >
          {importRows.isPending
            ? "Importing…"
            : `Import ${ok.length.toLocaleString()} prospect${ok.length === 1 ? "" : "s"}`}
        </Button>
      </div>
    </PageSection>
  )
}

function Done({
  result,
  onAgain,
}: {
  result: ImportResult
  onAgain: () => void
}) {
  return (
    <PageSection title="Import finished">
      <div className="rounded-xl border bg-card p-5 shadow-xs">
        <p className="flex items-center gap-2 text-lg font-semibold">
          <IconCircleCheck className="size-6 text-success" />
          Added {result.created.toLocaleString()} prospect
          {result.created === 1 ? "" : "s"}
        </p>
        {result.skipped.length > 0 && (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              {result.skipped.length} skipped because they look like people you
              already have:
            </p>
            <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto text-sm">
              {result.skipped.map((s) => (
                <li key={s.row}>
                  Row {s.row}, <span className="font-medium">{s.name}</span>:{" "}
                  <span className="text-muted-foreground">{s.reason}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button nativeButton={false} render={<Link href="/triage" />}>
            Rate the new prospects
          </Button>
          <Button variant="outline" onClick={onAgain}>
            Import another file
          </Button>
        </div>
      </div>
    </PageSection>
  )
}

function Export() {
  return (
    <PageSection
      title="Export"
      hint="A CSV of every prospect with all their details. Opens in Excel or Google Sheets."
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <p className="text-sm text-muted-foreground">
          The file holds customer details. Keep it on bank devices and delete it
          when you&apos;re done.
        </p>
        <Button
          variant="outline"
          nativeButton={false}
          render={<a href="/api/prospects/export" download />}
        >
          <IconDownload data-icon="inline-start" /> Download CSV
        </Button>
      </div>
    </PageSection>
  )
}
