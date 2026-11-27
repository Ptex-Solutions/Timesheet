import { auth } from "@/lib/auth";
import { Topbar } from "@/components/shared/app-topbar";
import { PageHeader } from "@/components/shared/page-header";
import { localTodayIso } from "@/lib/entry-date";
import { formatDate } from "@/lib/utils";
import { TimesheetTable } from "./timesheet-table";
import { PAGE_SIZE, latestEntryHint, listMyTimesheets, type TimesheetListParams } from "./rows";
import { Pagination, TimesheetFilters } from "./list-controls";

export default async function MyTimesheetsPage({
  searchParams,
}: {
  searchParams: TimesheetListParams & { add?: string };
}) {
  const session = await auth();
  const userId = session!.user.id;

  const [list, dateHints] = await Promise.all([
    listMyTimesheets(userId, searchParams, localTodayIso()),
    // The page may not show the latest logged day; it still steers new rows' date.
    latestEntryHint(userId),
  ]);
  const { range } = list;
  const rangeLabel = range
    ? range.from === range.to
      ? formatDate(range.from)
      : `${formatDate(range.from)} – ${formatDate(range.to)}`
    : null;

  return (
    <>
      <Topbar title="My Timesheets" subtitle="All entries you've logged" />
      <div className="p-6">
        <PageHeader
          title="All My Timesheets"
          description="Add entries right in the table, clone past ones, edit drafts, or submit pending entries."
        />
        <TimesheetFilters
          view={list.view}
          rangeLabel={rangeLabel}
          clients={list.clients}
          total={list.total}
          totalHours={list.totalHours}
        />
        <TimesheetTable
          rows={list.rows}
          autoAdd={searchParams.add === "1"}
          dateHints={dateHints}
          sortable
          emptyText={list.total === 0 && list.view === "all" ? "No timesheets yet." : "No entries match this view."}
        />
        <Pagination page={list.page} pages={list.pages} total={list.total} pageSize={PAGE_SIZE} />
      </div>
    </>
  );
}
