import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isStaffRole } from "@/lib/permissions";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect(isStaffRole(session.user.role) ? "/manager/dashboard" : "/employee/dashboard");
}
