"use client";
import dynamic from "next/dynamic";
import type { View } from "@/lib/types";
import { useDashboard } from "./dashboard-provider";
import { Results } from "./results";
const Validation = dynamic(() =>
  import("./validation").then((m) => m.ValidationView),
);
const Membership = dynamic(() =>
  import("./membership").then((m) => m.MembershipView),
);
const Gwo = dynamic(() => import("./gwo").then((m) => m.GwoView));
const Fis = dynamic(() => import("./fis").then((m) => m.FisView));
const Simulation = dynamic(() =>
  import("./simulation").then((m) => m.SimulationView),
);
const Team = dynamic(() => import("./team"));
const Motto = dynamic(() => import("./motto"));
export function DashboardView({ view }: { view: View }) {
  const { data, datasetId } = useDashboard();
  return (
    <section
      id={`view-${view}`}
      className={`view-section space-y-5 ${["fis", "gwo"].includes(view) ? "process-page" : ""}`}
      aria-labelledby="pageTitle"
    >
      {view === "anggota" ? (
        <Team />
      ) : view === "motto" ? (
        <Motto />
      ) : data ? (
        <div key={datasetId} className="space-y-5">
          {view === "hasil" ? (
            <Results data={data} />
          ) : view === "validasi" ? (
            <Validation data={data} />
          ) : view === "membership" ? (
            <Membership data={data} />
          ) : view === "gwo" ? (
            <Gwo data={data} />
          ) : view === "fis" ? (
            <Fis data={data} />
          ) : (
            <Simulation data={data} />
          )}
        </div>
      ) : null}
    </section>
  );
}
