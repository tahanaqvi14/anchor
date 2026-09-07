"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Flag, Handshake, Mic, Send, Square, Volume2, VolumeX, X } from "lucide-react";

import { PERSONAS } from "@/lib/personas";
import type { PersonaKey } from "@/lib/personas";
import { speak, stopSpeaking, useDictation, useSpeechSupported } from "@/lib/voice";
import { Button, ErrorNote, money } from "@/components/ui/primitives";
import { PositionTrack } from "@/components/position-track";
import type { SessionOutcome } from "@/lib/supabase/database.types";

export interface RoomMessage {
  seq: number;
  role: "user" | "ai";
  content: string;
}

interface Props {
  sessionId: string;
  personaKey: PersonaKey;
  scenarioTitle: string;
  unit: string;
  unitSuffix: string | null;
  currentOffer: number;
  target: number;
  initialMessages: RoomMessage[];
  initialPosition: number;
  turnsLeft: number;
  alreadyEnded: boolean;
}

export function NegotiationRoom({
  sessionId,
  personaKey,
  scenarioTitle,
  unit,
  unitSuffix,
  currentOffer,
  target,
  initialMessages,
  initialPosition,
  turnsLeft: initialTurnsLeft,
  alreadyEnded,
}: Props) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const persona = PERSONAS[personaKey];

  const [messages, setMessages] = useState<RoomMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [position, setPosition] = useState(initialPosition);
  const [turnsLeft, setTurnsLeft] = useState(initialTurnsLeft);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(alreadyEnded);
  const [endReason, setEndReason] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [showEndPanel, setShowEndPanel] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  const [sentByVoice, setSentByVoice] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const canSpeak = useSpeechSupported();

  const dictation = useDictation((text) => {
    setDraft((d) => (d ? `${d} ${text}` : text));
    setSentByVoice(true);
    inputRef.current?.focus();
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: reduced ? "auto" : "smooth",
    });
  }, [messages, thinking, reduced]);

  useEffect(() => () => stopSpeaking(), []);

  async function send() {
    const content = draft.trim();
    if (!content || thinking || ended) return;

    const wasVoice = sentByVoice;
    setDraft("");
    setSentByVoice(false);
    setError(null);
    stopSpeaking();

    // Optimistic: the user's own words should never lag behind their Enter.
    const optimisticSeq = (messages.at(-1)?.seq ?? 0) + 1;
    setMessages((m) => [...m, { seq: optimisticSeq, role: "user", content }]);
    setThinking(true);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/turn`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, inputMode: wasVoice ? "voice" : "text" }),
      });
      const json = await res.json();

      if (!res.ok) {
        // Roll the optimistic message back and hand the text to the user so
        // nothing they typed is ever lost to a failed request.
        setMessages((m) => m.filter((x) => x.seq !== optimisticSeq));
        setDraft(content);
        setError(json.error ?? "That did not go through.");
        if (json.code === "turn_limit") setTurnsLeft(0);
        return;
      }

      setMessages((m) => [...m, { seq: json.seq, role: "ai", content: json.reply }]);
      setPosition(json.position);
      setTurnsLeft(json.turnsLeft);
      if (readAloud) speak(json.reply, persona.voice);

      if (json.walked) {
        setEnded(true);
        setEndReason(`They ${json.walkReason ?? "ended the conversation"}.`);
      }
    } catch {
      setMessages((m) => m.filter((x) => x.seq !== optimisticSeq));
      setDraft(content);
      setError("Network error. Your message was not sent.");
    } finally {
      setThinking(false);
    }
  }

  async function finish(outcome: SessionOutcome) {
    setClosing(true);
    setError(null);
    stopSpeaking();
    try {
      const res = await fetch(`/api/sessions/${sessionId}/end`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outcome, finalValue: outcome === "deal" ? position : null }),
      });
      const json = await res.json();
      if (!res.ok && json.code !== "report_failed") {
        setError(json.error ?? "Could not end the negotiation.");
        setClosing(false);
        return;
      }
      router.push(`/session/${sessionId}/report`);
      router.refresh();
    } catch {
      setError("Network error while ending the negotiation.");
      setClosing(false);
    }
  }

  const canSend = draft.trim().length > 0 && !thinking && !ended;
  const outOfTurns = turnsLeft <= 0;

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      {/* The live axis. Watching the marker refuse to move is the product,
          so it gets the top of the screen rather than a figure in a corner. */}
      <div className="border-b border-rule bg-paper-sunken">
        <div className="mx-auto max-w-3xl px-5 py-3.5 sm:px-8">
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="label label-strong truncate">{scenarioTitle}</p>
            <p className="label truncate text-steel">{persona.title}</p>
          </div>
          <PositionTrack
            anchor={currentOffer}
            current={position}
            target={target}
            unit={unit}
            unitSuffix={unitSuffix}
            size="sm"
            showLabels={false}
          />
        </div>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
          <div className="mb-8 flex items-center gap-3 border-b border-rule pb-4">
            <span className="label">Opened</span>
            <span className="tnum text-[13px] text-ink-muted">
              {money(currentOffer, unit, unitSuffix)}
            </span>
            <span className="h-px flex-1 bg-rule" />
            <span className="label">Target</span>
            <span className="tnum text-[13px] font-medium text-brass">
              {money(target, unit, unitSuffix)}
            </span>
          </div>

          <div className="space-y-5">
            {messages.map((m) => (
              <Bubble key={m.seq} message={m} reduced={!!reduced} />
            ))}

            {thinking && <Thinking />}
          </div>

          <AnimatePresence>
            {ended && (
              <motion.div
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-10 border-t-2 border-rule-strong pt-6 text-center"
              >
                <p className="display text-[1.5rem] font-semibold">
                  {endReason ?? "This negotiation has ended."}
                </p>
                <p className="mt-1.5 text-[13.5px] text-ink-muted">
                  Your report is where the useful part is.
                </p>
                <Button className="mt-4" onClick={() => finish("ai_walked")} loading={closing}>
                  See the report
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Composer */}
      {!ended && (
        <div className="border-t border-rule bg-paper">
          <div className="mx-auto max-w-3xl px-5 py-4 sm:px-8">
            {error && (
              <div className="mb-3">
                <ErrorNote>{error}</ErrorNote>
              </div>
            )}

            {dictation.error && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-rule bg-paper-sunken px-3 py-2 text-[13px] text-ink-muted">
                <span className="flex-1">{dictation.error}</span>
                <button
                  onClick={dictation.dismissError}
                  aria-label="Dismiss"
                  className="text-ink-faint hover:text-ink"
                >
                  <X className="size-3.5" strokeWidth={2} />
                </button>
              </div>
            )}

            {outOfTurns ? (
              <div className="border border-rule bg-paper-sunken px-4 py-3.5 text-center text-[13.5px] text-ink-muted">
                You have used all your turns. Close it out below.
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <div className="relative flex-1">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={dictation.listening && dictation.interim ? `${draft} ${dictation.interim}`.trim() : draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder={dictation.listening ? "Listening..." : "Make your case..."}
                    disabled={thinking}
                    className="max-h-40 w-full resize-none border border-rule bg-paper-raised py-3.5 pl-4 pr-12 text-[15px] leading-relaxed text-ink transition-colors placeholder:text-ink-faint focus:border-brass focus:outline-none disabled:opacity-60"
                    style={{ minHeight: "3rem" }}
                  />
                  {dictation.supported && (
                    <button
                      type="button"
                      onClick={dictation.listening ? dictation.stop : dictation.start}
                      disabled={thinking}
                      aria-label={dictation.listening ? "Stop dictating" : "Dictate your reply"}
                      className={`absolute bottom-3 right-3 grid size-7 place-items-center transition-colors disabled:opacity-40 ${
                        dictation.listening
                          ? "bg-walk text-paper"
                          : "text-ink-faint hover:text-ink"
                      }`}
                    >
                      {dictation.listening ? (
                        <Square className="size-3 fill-current" strokeWidth={2} />
                      ) : (
                        <Mic className="size-4" strokeWidth={1.75} />
                      )}
                    </button>
                  )}
                </div>

                <Button
                  onClick={send}
                  disabled={!canSend}
                  aria-label="Send"
                  className="h-[3.4rem] w-[3.4rem] shrink-0 !px-0"
                >
                  <Send className="size-4" strokeWidth={2} />
                </Button>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="label">
                {turnsLeft} turn{turnsLeft === 1 ? "" : "s"} left
              </span>

              {canSpeak && (
                <button
                  onClick={() => {
                    setReadAloud((v) => !v);
                    if (readAloud) stopSpeaking();
                  }}
                  className="label inline-flex items-center gap-1.5 transition-colors hover:text-ink"
                >
                  {readAloud ? (
                    <Volume2 className="size-3.5 text-brass" strokeWidth={1.75} />
                  ) : (
                    <VolumeX className="size-3.5" strokeWidth={1.75} />
                  )}
                  {readAloud ? "Reading replies aloud" : "Read replies aloud"}
                </button>
              )}

              <button
                onClick={() => setShowEndPanel((v) => !v)}
                className="label ml-auto transition-colors hover:text-ink"
              >
                End negotiation
              </button>
            </div>

            <AnimatePresence>
              {showEndPanel && (
                <motion.div
                  initial={reduced ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-rule pt-3">
                    <Button size="sm" onClick={() => finish("deal")} loading={closing}>
                      <Handshake className="size-3.5" strokeWidth={1.75} />
                      Accept at {money(position, unit, unitSuffix)}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => finish("user_walked")}
                      loading={closing}
                    >
                      <Flag className="size-3.5" strokeWidth={1.75} />
                      Walk away
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => finish("no_deal")}
                      loading={closing}
                    >
                      Stop without a deal
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */

function Bubble({
  message,
  reduced,
}: {
  message: RoomMessage;
  reduced: boolean;
}) {
  const mine = message.role === "user";
  return (
    <motion.div
      id={`msg-${message.seq}`}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="scroll-mt-24"
    >
      {/* Indexed transcript lines rather than chat bubbles. The gutter
          number is what the report cites, so it belongs in how a message is
          read, not in a tooltip. */}
      <div className="flex gap-4">
        <div className="w-12 shrink-0 pt-0.5 text-right">
          <div className="index">{String(message.seq).padStart(2, "0")}</div>
          {/* "Them", not the persona name: the gutter is a fixed narrow
              column and a name like "Professional" overflows it into the
              message body. The opponent is identified in the header. */}
          <div className={`label mt-1 ${mine ? "text-brass" : "text-steel"}`}>
            {mine ? "You" : "Them"}
          </div>
        </div>
        <div
          className={`min-w-0 flex-1 border-l-2 pl-4 text-[14.5px] leading-[1.6] ${
            mine ? "border-brass text-ink" : "border-rule text-ink-muted"
          }`}
        >
          {message.content}
        </div>
      </div>
    </motion.div>
  );
}

function Thinking() {
  return (
    <div className="flex gap-4">
      <div className="w-12 shrink-0 pt-0.5 text-right">
        <div className="label text-steel">Them</div>
      </div>
      <div className="inline-flex items-center gap-1.5 border-l-2 border-rule py-1 pl-4">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-bounce rounded-full bg-steel"
            style={{ animationDelay: `${i * 140}ms`, animationDuration: "1s" }}
          />
        ))}
        <span className="label ml-2">considering their position</span>
      </div>
    </div>
  );
}
