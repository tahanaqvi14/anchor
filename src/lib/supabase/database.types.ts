/**
 * Database types, hand-written to match supabase/migrations.
 *
 * Kept by hand rather than generated so the shapes stay readable and
 * reviewable in diffs. If the schema and this file ever disagree, the
 * migration is the source of truth — re-run scripts/verify-setup.mjs after
 * any change.
 */

export type SessionStatus = "active" | "completed" | "abandoned";
export type SessionOutcome = "deal" | "no_deal" | "user_walked" | "ai_walked";
export type MessageRole = "user" | "ai";
export type InputMode = "text" | "voice";

/** One field in a scenario's declarative setup form. */
export type ContextField = {
  key: string;
  label: string;
  type: "currency" | "number" | "text" | "textarea";
  required: boolean;
  placeholder?: string;
  help?: string;
}

export type ScenarioRow = {
  id: string;
  user_id: string | null;
  is_preset: boolean;
  slug: string | null;
  title: string;
  summary: string;
  user_role: string;
  ai_role: string;
  unit: string;
  unit_suffix: string | null;
  context_fields: ContextField[];
  created_at: string;
}

export type SessionRow = {
  id: string;
  user_id: string;
  scenario_id: string;
  persona_key: string;
  persona_version: number;
  status: SessionStatus;
  outcome: SessionOutcome | null;
  context: Record<string, unknown>;
  target_value: number | null;
  opening_anchor: number | null;
  final_value: number | null;
  score: number | null;
  message_count: number;
  started_at: string;
  ended_at: string | null;
}

export type MessageRow = {
  id: string;
  session_id: string;
  user_id: string;
  seq: number;
  role: MessageRole;
  content: string;
  input_mode: InputMode;
  created_at: string;
}

/** One cited observation in a report. `message_seq` points at the exact
 *  transcript line, and `quote` must be verbatim from it — the generator
 *  rejects and regenerates anything that fails that check. */
export type ReportCitation = {
  title: string;
  detail: string;
  message_seq: number;
  quote: string;
}

export type ReportAlternative = {
  message_seq: number;
  you_said: string;
  try_instead: string;
  why: string;
}

export type FeedbackReportRow = {
  id: string;
  session_id: string;
  user_id: string;
  score: number;
  headline: string;
  outcome_summary: string;
  strengths: ReportCitation[];
  missteps: ReportCitation[];
  alternative_phrasings: ReportAlternative[];
  target_delta: number | null;
  model: string;
  raw: unknown;
  created_at: string;
}

export type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_demo: boolean;
  created_at: string;
}

/**
 * Shape consumed by @supabase/supabase-js generics.
 *
 * Every table needs a `Relationships` key and an `Update` that satisfies
 * `Record<string, unknown>`. Omitting either makes the whole Database type
 * fail the client's structural constraint, at which point inference
 * silently collapses to `never` on every query — which surfaces as dozens
 * of "Property does not exist on type 'never'" errors far from the cause.
 *
 * Note that `Update` describes what Postgres would accept, not what RLS
 * permits: messages and feedback_reports are append-only by policy, and
 * that is enforced in the database rather than in the type system.
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      scenarios: {
        Row: ScenarioRow;
        Insert: Omit<ScenarioRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<ScenarioRow>;
        Relationships: [];
      };
      sessions: {
        Row: SessionRow;
        Insert: Omit<SessionRow, "id" | "started_at" | "message_count"> & {
          id?: string;
          message_count?: number;
          /* Seeding backdates history, and Postgres accepts an explicit
             value for a column that merely has a default. */
          started_at?: string;
        };
        Update: Partial<SessionRow>;
        Relationships: [];
      };
      messages: {
        Row: MessageRow;
        Insert: Omit<MessageRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<MessageRow>;
        Relationships: [];
      };
      feedback_reports: {
        Row: FeedbackReportRow;
        Insert: Omit<FeedbackReportRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<FeedbackReportRow>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
