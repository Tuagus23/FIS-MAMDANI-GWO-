import { notFound } from "next/navigation";
import { DashboardView } from "@/components/dashboard-view";
import { ProjectBasis } from "@/components/project-basis";
import Team from "@/components/team";
import { views } from "@/lib/data";
import type { View } from "@/lib/types";
export function generateStaticParams() {
  return Object.keys(views)
    .filter((key) => key !== "hasil")
    .map((view) => ({ view }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  return { title: views[view as View]?.title || "Halaman" };
}
export default async function Page({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  if (!(view in views)) notFound();
  if (view === "dasar-proyek") return <ProjectBasis />;
  if (view === "anggota") return <Team />;
  return <DashboardView view={view as View} />;
}
