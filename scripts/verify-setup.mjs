/**
 * Setup verification.
 *
 * Run with:  node --env-file=.env.local scripts/verify-setup.mjs
 *
 * This does not trust the dashboard's "RLS enabled" badge. It creates two
 * throwaway users, has each insert a session, and then asserts that user B
 * genuinely cannot read user A's row through the publishable key — which is
 * the only evidence that multi-tenancy is enforced by Postgres rather than
 * by application code that could later be bypassed. Both users are deleted
 * at the end, and the cascade takes their rows with them.
 */

import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const GEMINI = process.env.GEMINI_API_KEY;

let failures = 0;
const ok = (m) => console.log(`  \x1b[32mPASS\x1b[0m  ${m}`);
const bad = (m) => {
  failures++;
  console.log(`  \x1b[31mFAIL\x1b[0m  ${m}`);
};
const info = (m) => console.log(`        ${m}`);
const head = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`);

const TABLES = ["profiles", "scenarios", "sessions", "messages", "feedback_reports"];
const TEST_PREFIX = "anchor-rls-probe";

const admin = createClient(URL, SECRET, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* ---------------------------------------------------------------- */
head("1. Schema");

for (const t of TABLES) {
  const { error, count } = await admin.from(t).select("*", { count: "exact", head: true });
  if (error) bad(`${t} — ${error.message}`);
  else ok(`${t} exists (${count} rows)`);
}

const { data: presets, error: presetErr } = await admin
  .from("scenarios")
  .select("slug")
  .eq("is_preset", true);

if (presetErr) bad(`preset seed — ${presetErr.message}`);
else if (presets.length !== 6) bad(`expected 6 preset scenarios, found ${presets.length}`);
else ok(`6 preset scenarios seeded (${presets.map((p) => p.slug).join(", ")})`);

/* ---------------------------------------------------------------- */
head("2. RLS denies anonymous reads");

const anon = createClient(URL, PUBLISHABLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

for (const t of TABLES) {
  const { data, error } = await anon.from(t).select("*").limit(1);
  if (error) ok(`${t} — blocked (${error.code ?? "error"})`);
  else if (data.length === 0) ok(`${t} — returns no rows to an anonymous caller`);
  else bad(`${t} — LEAKED ${data.length} row(s) without authentication`);
}

/* ---------------------------------------------------------------- */
head("3. RLS isolates one user from another");

const stamp = Date.now();
const users = [];

async function makeUser(n) {
  const email = `${TEST_PREFIX}-${stamp}-${n}@example.com`;
  const password = `Probe!${stamp}${n}aA`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`could not create test user: ${error.message}`);
  users.push(data.user.id);

  const client = createClient(URL, PUBLISHABLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`could not sign in test user: ${signInErr.message}`);
  return { id: data.user.id, client };
}

try {
  const scenarioId = (
    await admin.from("scenarios").select("id").eq("slug", "salary").single()
  ).data.id;

  const a = await makeUser("a");
  const b = await makeUser("b");
  ok("created two authenticated test users");

  // The profiles row should have been created by the on_auth_user_created trigger.
  const { data: profA } = await a.client.from("profiles").select("id").eq("id", a.id);
  if (profA?.length === 1) ok("handle_new_user trigger created the profile row");
  else bad("profile row was not auto-created on signup");

  // A preset must be visible to any authenticated user.
  const { data: presetsAsA } = await a.client.from("scenarios").select("id").eq("is_preset", true);
  if (presetsAsA?.length === 6) ok("authenticated user can read the 6 shared presets");
  else bad(`authenticated user saw ${presetsAsA?.length ?? 0} presets, expected 6`);

  // User A opens a session.
  const { data: sessionA, error: insErr } = await a.client
    .from("sessions")
    .insert({
      user_id: a.id,
      scenario_id: scenarioId,
      persona_key: "professional",
      context: { target: 175000 },
      target_value: 175000,
    })
    .select("id")
    .single();

  if (insErr) bad(`user A could not create their own session — ${insErr.message}`);
  else ok("user A created a session");

  if (sessionA) {
    // The whole point: B must not see it.
    const { data: leak } = await b.client.from("sessions").select("id").eq("id", sessionA.id);
    if (leak?.length) bad("user B READ user A's session — RLS is not isolating tenants");
    else ok("user B cannot read user A's session");

    // B must not be able to write into A's session either.
    const { error: fkErr } = await b.client.from("messages").insert({
      session_id: sessionA.id,
      user_id: b.id,
      seq: 1,
      role: "user",
      content: "probe",
    });
    if (fkErr) ok(`user B cannot append to user A's transcript (${fkErr.code})`);
    else bad("user B WROTE into user A's transcript");

    // Transcripts are append-only: A cannot edit their own message.
    await a.client.from("messages").insert({
      session_id: sessionA.id,
      user_id: a.id,
      seq: 1,
      role: "user",
      content: "original",
    });
    const { data: upd } = await a.client
      .from("messages")
      .update({ content: "rewritten" })
      .eq("session_id", sessionA.id)
      .select("id");
    if (upd?.length) bad("a user rewrote their own transcript — it must be append-only");
    else ok("even the owner cannot rewrite a transcript message");

    // message_count trigger
    const { data: sess } = await a.client
      .from("sessions")
      .select("message_count")
      .eq("id", sessionA.id)
      .single();
    if (sess?.message_count === 1) ok("bump_message_count trigger fired");
    else bad(`message_count was ${sess?.message_count}, expected 1`);
  }
} catch (e) {
  bad(e.message);
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id);
  if (users.length) info(`cleaned up ${users.length} test user(s) and their cascaded rows`);
}

/* ---------------------------------------------------------------- */
head("4. Gemini");

if (!GEMINI) {
  bad("GEMINI_API_KEY is empty");
} else {
  const ai = new GoogleGenAI({ apiKey: GEMINI });
  for (const [label, model] of [
    ["chat  ", process.env.GEMINI_CHAT_MODEL],
    ["report", process.env.GEMINI_REPORT_MODEL],
  ]) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: "Reply with exactly: OK",
      });
      ok(`${label} model "${model}" responded (${res.text?.trim().slice(0, 20)})`);
    } catch (e) {
      bad(`${label} model "${model}" — ${e.message?.split("\n")[0]?.slice(0, 140)}`);
    }
  }
}

/* ---------------------------------------------------------------- */
console.log(
  failures === 0
    ? "\n\x1b[32mAll checks passed.\x1b[0m\n"
    : `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`,
);
process.exit(failures === 0 ? 0 : 1);
