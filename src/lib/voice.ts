"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { VoiceProfile } from "./personas";

/**
 * Web Speech API wrappers.
 *
 * Voice is an enhancement layer and is treated as one throughout: every
 * entry point feature-detects, every failure resolves back to the text
 * input, and no recognition error is ever allowed to block the negotiation.
 * SpeechRecognition in particular is unsupported in Firefox and requires a
 * secure context, so "unavailable" is a normal state rather than an error.
 */

/* The API is still vendor-prefixed and is not in the DOM lib types. */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
  length: number;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const FRIENDLY_ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow it in your browser, or just type.",
  "service-not-allowed": "Your browser blocked speech recognition. Typing works fine.",
  "no-speech": "Didn't catch that — try again, or type instead.",
  network: "Speech recognition needs a connection. Type instead for now.",
  aborted: "",
  "audio-capture": "No microphone found. Type instead.",
};

export interface DictationState {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
}

/**
 * Push-to-talk dictation. Returns the final transcript through onFinal
 * rather than owning the input's value, so the text box remains the single
 * source of truth and dictation is only ever an alternative way to fill it.
 */
/* Capability detection is external state, so it is read through
   useSyncExternalStore rather than set into state from an effect. The
   server snapshot is false, so SSR renders the text-only composer and the
   client corrects it immediately after hydration with no mismatch. */
const subscribeNever = () => () => {};
const getSupportedSnapshot = () => getRecognitionCtor() !== null;
const getSupportedServerSnapshot = () => false;

export function useDictation(onFinal: (text: string) => void) {
  const supported = useSyncExternalStore(
    subscribeNever,
    getSupportedSnapshot,
    getSupportedServerSnapshot,
  );

  const [state, setState] = useState<Omit<DictationState, "supported">>({
    listening: false,
    interim: "",
    error: null,
  });
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const onFinalRef = useRef(onFinal);

  // Assigning a ref during render is a React violation; the callback is
  // refreshed after commit instead, which is soon enough because it is only
  // ever read from recognition events.
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    },
    [],
  );

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setState((s) => ({ ...s, error: "Speech input is not available in this browser." }));
      return;
    }

    try {
      const recognition = new Ctor();
      recognition.lang = navigator.language || "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;
      finalRef.current = "";

      recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript ?? "";
          if (result.isFinal) finalRef.current += text;
          else interim += text;
        }
        setState((s) => ({ ...s, interim }));
      };

      recognition.onerror = (e) => {
        const message = FRIENDLY_ERRORS[e.error] ?? "Speech input failed. Type instead.";
        setState((s) => ({ ...s, listening: false, interim: "", error: message || null }));
      };

      recognition.onend = () => {
        const text = finalRef.current.trim();
        finalRef.current = "";
        setState((s) => ({ ...s, listening: false, interim: "" }));
        if (text) onFinalRef.current(text);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setState((s) => ({ ...s, listening: true, error: null, interim: "" }));
    } catch {
      setState((s) => ({ ...s, listening: false, error: "Could not start the microphone. Type instead." }));
    }
  }, []);

  const dismissError = useCallback(() => setState((s) => ({ ...s, error: null })), []);

  return { ...state, supported, start, stop, dismissError };
}

/* ------------------------------------------------------------------ */

let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  if (cachedVoices.length === 0) cachedVoices = window.speechSynthesis.getVoices();
  return cachedVoices;
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  // Voices load asynchronously in most browsers and the list starts empty.
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Hook form of the check above. Calling speechSupported() directly during
 * render makes the server and client disagree — the server always says no —
 * which React reports as a hydration mismatch. The server snapshot here
 * makes that disagreement explicit and legal.
 */
const getSpeechSnapshot = () => speechSupported();
export function useSpeechSupported(): boolean {
  return useSyncExternalStore(subscribeNever, getSpeechSnapshot, getSupportedServerSnapshot);
}

/**
 * Reads a line in the opponent's voice. The named voices in each persona
 * are preferences, never requirements — availability differs wildly by OS
 * and browser, so an unmatched name simply falls through to the default
 * voice with the persona's pitch and rate still applied. That keeps the
 * four opponents distinguishable everywhere.
 */
export function speak(text: string, profile: VoiceProfile): void {
  if (!speechSupported()) return;
  try {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = profile.pitch;
    utterance.rate = profile.rate;

    const voices = loadVoices();
    const match = profile.preferredVoices
      .map((name) => voices.find((v) => v.name.toLowerCase().includes(name.toLowerCase())))
      .find(Boolean);
    if (match) utterance.voice = match;

    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech is decorative; never surface a failure here.
  }
}

export function stopSpeaking(): void {
  if (speechSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* no-op */
    }
  }
}
