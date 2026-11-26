export type Protocol = "FUZZY" | "LEACH" | "GWO";
export type Variable = "energy" | "distance" | "neighbors" | "output";
export type InputVariable = Exclude<Variable, "output">;
export type Metric = "FND" | "HND" | "LND" | "PDR_pct" | "lifetime_index";
export type View =
  | "hasil"
  | "dasar-proyek"
  | "validasi"
  | "membership"
  | "gwo"
  | "fis"
  | "anggota"
  | "motto"
  | "pengguna"
  | "simulasi";
export interface Dataset {
  id: string;
  label: string;
  description: string;
}
export interface Summary {
  protocol: Protocol;
  fnd: number | null;
  hnd: number | null;
  lnd: number | null;
  pdr_total_pct: number | null;
  last_round: number;
}
export interface HistoryRow {
  protocol: Protocol;
  round_number: number;
  alive_nodes: number;
}
export interface Validation {
  metric: Metric;
  FUZZY_mean: number | null;
  GWO_mean: number | null;
  mean_delta_GWO_minus_FUZZY: number | null;
  GWO_wins: number;
  FUZZY_wins: number;
  ties: number;
  seed_count: number;
}
export type SeedRow = { seed: number } & Partial<
  Record<`${"FUZZY" | "GWO"}_${Metric}`, number | null>
>;
export interface MembershipSpec {
  shape: "tri" | "trap";
  points: number[];
}
export type Membership = Record<Variable, Record<string, MembershipSpec>>;
export interface Rule {
  energy: string;
  distance: string;
  neighbors: string;
  output: string;
}
export interface FisProcess {
  rule_count: number;
  output_points: number;
  nodes: number;
  cluster_head_count: number;
  rules: Rule[];
}
export interface DashboardData {
  dataset: Dataset;
  horizon: number;
  validation_horizon: number;
  summary: Summary[];
  history: HistoryRow[];
  validation: Validation[];
  validation_rows: SeedRow[];
  membership: Membership;
  membership_baseline: Membership;
  membership_ranges: Record<Variable, { min: number; max: number }>;
  fis_process: FisProcess;
}
export interface DatasetsResponse {
  default: string;
  identity: { id: string; name: string; role: UserRole | "guest" };
  datasets: Dataset[];
}
export type UserRole = "member" | "super_admin";
export interface BootstrapResponse extends DatasetsResponse {
  data: DashboardData | null;
  data_error?: string;
}
export interface DashboardUser {
  id: string;
  login_id: string;
  name: string;
  role: UserRole;
  active: boolean;
  logged_in: boolean;
  login_started_at: string | null;
  last_seen_at: string | null;
  current_page: string | null;
  session_count: number;
  updated_at: string;
}
export interface AccessActivity {
  id: number;
  actor_name: string;
  target_name: string;
  old_role: UserRole;
  new_role: UserRole;
  old_active: boolean;
  new_active: boolean;
  created_at: string;
  action: "access_updated" | "session_kicked";
  session_count: number | null;
}
export interface UsersResponse {
  users: DashboardUser[];
  activity: AccessActivity[];
  server_time: string;
}
export interface SimulationConfig {
  nodes: number;
  rounds: number;
  seed: number;
  cluster_head_count: number;
  dataset_id: string;
  dataset_label?: string;
}
export interface SimulationResult {
  config: SimulationConfig;
  summary: Summary[];
  history: HistoryRow[];
}
export interface GwoHistory {
  iteration: number;
  best_fitness: number;
  mean_fitness: number;
}
export interface Wolf {
  iteration: number;
  wolf: number;
  rank: number;
  role: string;
  fitness: number;
  position: number[];
}
export interface GwoData {
  dataset_id: string;
  dataset_label: string;
  matches_saved_membership: boolean;
  reproduced: boolean;
  configuration: {
    wolves: number;
    iterations: number;
    evaluations: number;
    dimension: number;
    optimizer_seed: number;
    fitness_mode: string;
    fitness_rounds: number;
    fitness_seeds: number[];
    simulation: { nodes: number; width_m: number; height_m: number };
  };
  weights: Record<string, number>;
  comparison: Record<"manual" | "warm_start" | "best", Record<string, number>>;
  history: GwoHistory[];
  population: Wolf[];
}
