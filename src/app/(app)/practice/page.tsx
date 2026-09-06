import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { SetupFlow } from "@/components/practice/setup-flow";
import { EmptyState } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "New negotiation" };

export default async function PracticePage() {
  const supabase = await createClient();

  // RLS returns presets plus this user's own custom scenarios, nothing else.
  const { data: scenarios, error } = await supabase
    .from("scenarios")
    .select("*")
    .order("is_preset", { ascending: false })
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      {error ? (
        <EmptyState
          icon={<AlertTriangle className="size-5" strokeWidth={1.75} />}
          title="Could not load scenarios"
          body="The database did not respond. Refresh the page — if it keeps happening, the project may be paused."
        />
      ) : !scenarios?.length ? (
        <EmptyState
          icon={<AlertTriangle className="size-5" strokeWidth={1.75} />}
          title="No scenarios found"
          body="The preset scenarios have not been seeded. Run migration 0002_seed_scenarios.sql in the Supabase SQL editor."
        />
      ) : (
        <SetupFlow scenarios={scenarios} />
      )}
    </div>
  );
}
