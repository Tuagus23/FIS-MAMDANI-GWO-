import type { Metadata } from "next";
import { Login } from "@/components/login";
export const metadata: Metadata = { title: "Masuk" };
export default function Page() {
  return <Login />;
}
