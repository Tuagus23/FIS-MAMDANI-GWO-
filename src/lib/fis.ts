import type { FisProcess, InputVariable, Membership } from "./types";
import { degree } from "./data";
export function calculateFis(
  membership: Membership,
  fis: FisProcess,
  inputs: Record<InputVariable, number>,
) {
  const variables = ["energy", "distance", "neighbors"] as const;
  const degrees = Object.fromEntries(
    variables.map((key) => [
      key,
      Object.fromEntries(
        Object.entries(membership[key]).map(([label, spec]) => [
          label,
          degree(spec, inputs[key]),
        ]),
      ),
    ]),
  ) as Record<InputVariable, Record<string, number>>;
  const rules = fis.rules.map((rule, index) => ({
    ...rule,
    index: index + 1,
    strength: Math.min(
      degrees.energy[rule.energy],
      degrees.distance[rule.distance],
      degrees.neighbors[rule.neighbors],
    ),
  }));
  const activations: Record<string, number> = {
    Rendah: 0,
    Sedang: 0,
    Tinggi: 0,
  };
  rules.forEach((rule) => {
    activations[rule.output] = Math.max(
      activations[rule.output],
      rule.strength,
    );
  });
  const x = Array.from(
    { length: fis.output_points },
    (_, i) => i / (fis.output_points - 1),
  );
  const aggregate = x.map((value) =>
    Math.max(
      ...Object.entries(activations).map(([label, strength]) =>
        Math.min(strength, degree(membership.output[label], value)),
      ),
    ),
  );
  let area = 0,
    moment = 0;
  for (let i = 0; i < x.length - 1; i++) {
    const dx = x[i + 1] - x[i];
    area += ((aggregate[i] + aggregate[i + 1]) * dx) / 2;
    moment += ((aggregate[i] * x[i] + aggregate[i + 1] * x[i + 1]) * dx) / 2;
  }
  return {
    degrees,
    rules,
    activations,
    x,
    aggregate,
    score: area > 1e-15 ? moment / area : 0.5,
  };
}
