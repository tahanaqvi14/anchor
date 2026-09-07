"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, PenLine } from "lucide-react";

import { PERSONA_LIST } from "@/lib/personas";
import type { PersonaKey } from "@/lib/personas";
import type { ContextField, ScenarioRow } from "@/lib/supabase/database.types";
import { Button, ErrorNote, Field, inputClass } from "@/components/ui/primitives";

/**
 * Three-step setup: scenario, opponent, then the numbers.
 *
 * The context form is rendered from each scenario's declarative
 * `context_fields` spec rather than hard-coded per scenario, so adding a
 * scenario stays a database change.
 */

const CUSTOM_FIELDS: ContextField[] = [
  {
    key: "currentOffer",
    label: "Their current offer",
    type: "currency",
    required: true,
    placeholder: "1000",
  },
  { key: "target", label: "Your target", type: "currency", required: true, placeholder: "1500" },
  {
    key: "walkAway",
    label: "Your walk-away number",
    type: "currency",
    required: false,
    help: "Kept private. The opponent never sees this.",
  },
  {
    key: "leverage",
    label: "Anything they should know",
    type: "textarea",
    required: false,
    placeholder: "Context, leverage, constraints...",
  },
];

type Step = "scenario" | "persona" | "context";

export function SetupFlow({ scenarios }: { scenarios: ScenarioRow[] }) {
  const router = useRouter();
  const reduced = useReducedMotion();

  const [step, setStep] = useState<Step>("scenario");
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [persona, setPersona] = useState<PersonaKey | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const scenario = useMemo(
    () => scenarios.find((s) => s.id === scenarioId) ?? null,
    [scenarioId, scenarios],
  );
  const isCustom = scenarioId === "custom";
  const fields = isCustom ? CUSTOM_FIELDS : (scenario?.context_fields ?? []);

  async function start() {
    setError(null);

    for (const f of fields) {
      if (f.required && !values[f.key]?.trim()) {
        setError(`${f.label} is required.`);
        return;
      }
    }
    if (isCustom && !customTitle.trim()) {
      setError("Describe the situation you want to practise.");
      return;
    }

    setStarting(true);
    try {
      let targetScenarioId = scenarioId;

      // A custom scenario becomes a real row so it can be replayed later and
      // shows up in history like any other.
      if (isCustom) {
        const res = await fetch("/api/scenarios", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: customTitle.trim() }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not save that scenario");
        targetScenarioId = json.scenarioId;
      }

      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenarioId: targetScenarioId, personaKey: persona, context: values }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not start the negotiation");

      router.push(`/session/${json.sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStarting(false);
    }
  }

  const slide = reduced
    ? {}
    : {
        initial: { opacity: 0, x: 16 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -16 },
        // mode="wait" runs exit then enter, so this duration is paid twice
        // between steps. Kept short for that reason.
        transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] as const },
      };

  return (
    <div>
      <Steps current={step} />

      <AnimatePresence mode="wait" initial={false}>
        {step === "scenario" && (
          <motion.div key="scenario" {...slide}>
            <h2 className="display-xl mt-8 text-[clamp(1.9rem,4.5vw,2.9rem)]">
              What are you negotiating?
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {scenarios.map((s) => (
                <Card
                  key={s.id}
                  selected={scenarioId === s.id}
                  onClick={() => {
                    setScenarioId(s.id);
                    setValues({});
                    setStep("persona");
                  }}
                  title={s.title}
                  body={s.summary}
                />
              ))}
              <Card
                selected={isCustom}
                onClick={() => {
                  setScenarioId("custom");
                  setValues({});
                  setStep("persona");
                }}
                title="Something else"
                body="Describe your own situation and negotiate that instead."
                icon={<PenLine className="size-4" strokeWidth={1.75} />}
              />
            </div>
          </motion.div>
        )}

        {step === "persona" && (
          <motion.div key="persona" {...slide}>
            <h2 className="display-xl mt-8 text-[clamp(1.9rem,4.5vw,2.9rem)]">
              Who are you up against?
            </h2>
            <p className="mt-2 text-[15px] text-ink-muted">
              Each one concedes for different reasons. None of them concede for free.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {PERSONA_LIST.map((p) => (
                <Card
                  key={p.key}
                  selected={persona === p.key}
                  onClick={() => {
                    setPersona(p.key);
                    setStep("context");
                  }}
                  title={p.title}
                  body={p.tagline}
                  meter={p.difficulty}
                />
              ))}
            </div>
            <BackButton onClick={() => setStep("scenario")} />
          </motion.div>
        )}

        {step === "context" && (
          <motion.div key="context" {...slide}>
            <h2 className="display-xl mt-8 text-[clamp(1.9rem,4.5vw,2.9rem)]">
              Set the stakes.
            </h2>
            <p className="mt-2 text-[15px] text-ink-muted">
              Your target is what the report scores you against, so be honest about it.
            </p>

            <div className="mt-6 max-w-md space-y-4">
              {isCustom && (
                <Field
                  label="The situation"
                  help="One or two sentences. Who are you, who are they, and what is on the table?"
                >
                  <textarea
                    className={`${inputClass} min-h-24 resize-y`}
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="I'm a contractor renegotiating a retainer with a client who wants more scope for the same fee."
                  />
                </Field>
              )}

              {fields.map((f) => (
                <Field key={f.key} label={f.label} help={f.help}>
                  {f.type === "textarea" ? (
                    <textarea
                      className={`${inputClass} min-h-20 resize-y`}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                    />
                  ) : (
                    <input
                      type="text"
                      inputMode={f.type === "text" ? "text" : "decimal"}
                      className={`${inputClass} ${f.type !== "text" ? "tnum" : ""}`}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                    />
                  )}
                </Field>
              ))}

              {error && <ErrorNote>{error}</ErrorNote>}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button onClick={start} loading={starting} size="lg">
                  {starting ? "Starting" : "Begin negotiation"}
                  {!starting && <ArrowRight className="size-4" strokeWidth={2} />}
                </Button>
                {starting && (
                  <span className="text-[13px] text-ink-faint">
                    They are deciding how to open.
                  </span>
                )}
              </div>
            </div>

            <BackButton onClick={() => setStep("persona")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function Steps({ current }: { current: Step }) {
  const order: Step[] = ["scenario", "persona", "context"];
  const labels = { scenario: "Scenario", persona: "Opponent", context: "Stakes" };
  const idx = order.indexOf(current);

  return (
    <ol className="flex items-center gap-2">
      {order.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={`label inline-flex items-center gap-1.5 px-2 py-1 ${
              i === idx ? "bg-brass-wash text-brass" : i < idx ? "text-ink" : "text-ink-faint"
            }`}
          >
            {i < idx ? <Check className="size-3" strokeWidth={2.5} /> : null}
            {labels[s]}
          </span>
          {i < order.length - 1 && <span className="h-px w-4 bg-rule" />}
        </li>
      ))}
    </ol>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="label mt-10 inline-flex items-center gap-1.5 transition-colors hover:text-ink"
    >
      <ArrowLeft className="size-3.5" strokeWidth={2} />
      Back
    </button>
  );
}

function Card({
  selected,
  onClick,
  title,
  body,
  meter,
  icon,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  body: string;
  meter?: number;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex h-full flex-col border p-5 text-left transition-all duration-150 active:scale-[0.99] active:transition-none ${
        selected
          ? "border-brass bg-brass-wash"
          : "border-rule bg-paper-raised hover:border-rule-strong"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="display text-[1.25rem] font-semibold leading-tight text-balance">
          {icon && <span className="mr-2 inline-block align-middle text-ink-muted">{icon}</span>}
          {title}
        </h3>
        {meter !== undefined && (
          <span className="flex shrink-0 items-end gap-[3px] pt-1" title={`Difficulty ${meter} of 4`}>
            <span className="sr-only">Difficulty {meter} of 4</span>
            {[1, 2, 3, 4].map((n) => (
              <span
                key={n}
                aria-hidden="true"
                style={{ height: `${5 + n * 3}px` }}
                className={`w-[3px] rounded-full ${n <= meter ? "bg-brass" : "bg-rule-strong"}`}
              />
            ))}
          </span>
        )}
      </div>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted text-pretty">{body}</p>
    </button>
  );
}
