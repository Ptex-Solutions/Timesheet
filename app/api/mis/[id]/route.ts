import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/api-utils";
import { exportMISToBuffer } from "@/lib/export";

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const access = await requirePermission("mis.view");
  if (access instanceof NextResponse) return access;
  const id = parseInt(ctx.params.id, 10);
  const report = await prisma.mISReport.findUnique({
    where: { id },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const wantsExcel = req.nextUrl.searchParams.get("format") === "xlsx";
  if (wantsExcel) {
    const buf = exportMISToBuffer(report.data as any, report.title);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${report.title.replace(/[^a-z0-9-_]+/gi, "_")}.xlsx"`,
      },
    });
  }

  return NextResponse.json({ data: report });
}
