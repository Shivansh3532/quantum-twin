export const scenarios = ["compatibility", "direct"] as const;
export type Scenario = typeof scenarios[number];

export function parseScenario(value: string | null | undefined): Scenario {
  return value === "direct" ? "direct" : "compatibility";
}
