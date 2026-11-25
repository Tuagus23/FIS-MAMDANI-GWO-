import type { Metadata } from "next";
import { Login } from "@/components/login";
import { redirect } from "next/navigation";
import { PUBLIC_DASHBOARD } from "@/lib/access-mode";
export const metadata: Metadata = { title: "Masuk" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ admin?: string }>;
}) {
  if (PUBLIC_DASHBOARD && (await searchParams).admin !== "1") redirect("/");
  return <Login />;
}
