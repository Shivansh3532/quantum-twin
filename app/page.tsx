import Dashboard from "./ui";
import recordedRun from "@/sample/run.json";

export default function Page() {
  const recorded = process.env.VERCEL === "1" || !process.env.OPENAI_API_KEY;
  return <Dashboard recorded={recorded} initialReport={recorded ? recordedRun : null} />;
}
