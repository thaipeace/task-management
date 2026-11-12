"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getProjectByCode } from "@/lib/projects";
import { approveDevRelease } from "@/lib/releases";

// Nút Duyệt ở tab Dev release (chỉ admin): đợt đã release xong
export async function approveRelease(projectCode: string, version: string) {
  const me = await requireAdmin();
  const project = await getProjectByCode(projectCode);
  if (!project) throw new Error("Không có dự án này");
  const moved = await approveDevRelease(project.id, version, me);
  refresh();
  return moved.length;
}
