export const scenarios = ["compatibility", "direct", "public-compatibility", "public-direct"] as const;
export type Scenario = typeof scenarios[number];

export function parseScenario(value: string | null | undefined): Scenario {
  return scenarios.includes(value as Scenario) ? value as Scenario : "compatibility";
}
