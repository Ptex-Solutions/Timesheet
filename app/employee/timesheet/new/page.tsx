import { redirect } from "next/navigation";

// Entries are now added inline on "All My Timesheets"; ?add=1 opens a blank row.
export default function NewTimesheetPage() {
  redirect("/employee/timesheet?add=1");
}
