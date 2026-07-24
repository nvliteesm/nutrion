"use client";

import { useEffect, useRef, useState } from "react";
import { MicIcon } from "@/components/icons";
import { transcribeAudio } from "@/lib/api";

type VoiceState = "idle" | "recording" | "transcribing";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
  }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getBrowserSpeechRecognition(): (new () => BrowserSpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "";
}

/**
 * Mic for chat: prefers browser SpeechRecognition (no upload),
 * falls back to MediaRecorder → Azure Speech.
 */
export function VoiceInputButton({
  onTranscript,
  onError,
  disabled = false,
  compact = false,
}: VoiceInputButtonProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeRef = useRef("");
  const browserRecRef = useRef<BrowserSpeechRecognition | null>(null);
  const finalTextRef = useRef("");
  const interimTextRef = useRef("");
  /** True after the user taps stop — wait for onend before delivering text. */
  const stoppingRef = useRef(false);

  useEffect(() => {
    return () => {
      try {
        browserRecRef.current?.abort();
      } catch {
        /* ignore */
      }
      try {
        if (mediaRef.current?.state === "recording") mediaRef.current.stop();
      } catch {
        /* ignore */
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function cleanupMedia() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRef.current = null;
  }

  function deliverBrowserTranscript() {
    const text = `${finalTextRef.current} ${interimTextRef.current}`.trim();
    finalTextRef.current = "";
    interimTextRef.current = "";
    stoppingRef.current = false;
    setState("idle");
    if (text) onTranscript(text);
    else onError?.("No speech detected. Try again.");
  }

  function startBrowserSpeech(Ctor: new () => BrowserSpeechRecognition) {
    const rec = new Ctor();
    browserRecRef.current = rec;
    finalTextRef.current = "";
    interimTextRef.current = "";
    stoppingRef.current = false;
    // One utterance is more reliable for chat than continuous mode,
    // which often auto-ends on silence while the UI still looks "recording".
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const row = event.results[i];
        const piece = row?.[0]?.transcript?.trim() ?? "";
        if (!piece) continue;
        if (row.isFinal) {
          finalTextRef.current = `${finalTextRef.current} ${piece}`.trim();
          interimTextRef.current = "";
        } else {
          interim = `${interim} ${piece}`.trim();
        }
      }
      if (interim) interimTextRef.current = interim;
    };
    rec.onerror = (event) => {
      // "aborted" is expected when we tear down; ignore it.
      const code = event.error || "failed";
      if (code === "aborted") return;
      browserRecRef.current = null;
      stoppingRef.current = false;
      finalTextRef.current = "";
      interimTextRef.current = "";
      setState("idle");
      if (code === "not-allowed") onError?.("Microphone permission was denied.");
      else if (code === "no-speech") onError?.("No speech detected. Try again.");
      else onError?.(`Speech recognition error: ${code}`);
    };
    rec.onend = () => {
      // Always deliver here — finals often arrive only after stop()/silence.
      if (browserRecRef.current !== rec) return;
      browserRecRef.current = null;
      deliverBrowserTranscript();
    };
    rec.start();
    setState("recording");
  }

  async function startAzureRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
      },
    });
    streamRef.current = stream;
    const mime = pickMimeType();
    mimeRef.current = mime;
    const recorder = new MediaRecorder(
      stream,
      mime ? { mimeType: mime, audioBitsPerSecond: 128000 } : undefined,
    );
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onerror = () => {
      onError?.("Microphone recording failed.");
      cleanupMedia();
      setState("idle");
    };
    recorder.onstop = () => {
      void finishAzureRecording(recorder.mimeType || mimeRef.current || "audio/webm");
    };
    mediaRef.current = recorder;
    recorder.start(250);
    setState("recording");
  }

  async function startRecording() {
    if (disabled || state !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      onError?.("Voice input is not supported in this browser.");
      return;
    }

    const BrowserSpeech = getBrowserSpeechRecognition();
    if (BrowserSpeech) {
      try {
        startBrowserSpeech(BrowserSpeech);
        return;
      } catch {
        // Fall through to Azure upload path.
      }
    }

    if (typeof MediaRecorder === "undefined") {
      onError?.("Voice input is not supported in this browser.");
      return;
    }
    try {
      await startAzureRecording();
    } catch {
      onError?.("Microphone permission was denied.");
      setState("idle");
    }
  }

  function stopRecording() {
    if (browserRecRef.current) {
      if (stoppingRef.current) return;
      stoppingRef.current = true;
      setState("transcribing");
      try {
        browserRecRef.current.stop();
      } catch {
        browserRecRef.current = null;
        deliverBrowserTranscript();
      }
      return;
    }
    const recorder = mediaRef.current;
    if (!recorder || recorder.state !== "recording") return;
    setState("transcribing");
    try {
      recorder.requestData();
    } catch {
      /* ignore */
    }
    recorder.stop();
  }

  async function finishAzureRecording(mimeType: string) {
    const chunks = chunksRef.current;
    chunksRef.current = [];
    cleanupMedia();

    const blob = new Blob(chunks, { type: mimeType.split(";")[0] || mimeType });
    if (blob.size < 1000) {
      setState("idle");
      onError?.("Recording was too short. Speak a bit longer, then tap stop.");
      return;
    }

    const base = (mimeType.split(";")[0] || "audio/webm").toLowerCase();
    const ext = base.includes("mp4") ? "m4a" : base.includes("ogg") ? "ogg" : "webm";
    const file = new File([blob], `voice.${ext}`, { type: base });
    try {
      const { transcript } = await transcribeAudio(file);
      const text = transcript.trim();
      if (text) onTranscript(text);
      else onError?.("No speech detected. Try again.");
    } catch (err) {
      const raw =
        err instanceof Error ? err.message : "Transcription failed. Try again.";
      const message =
        /failed to fetch|networkerror|connection/i.test(raw)
          ? "Cannot reach the backend. Is uvicorn running on port 8000?"
          : raw;
      onError?.(message.length > 180 ? `${message.slice(0, 180)}…` : message);
    } finally {
      setState("idle");
    }
  }

  const busy = state !== "idle" || disabled;
  const size = compact ? "h-7 w-7 rounded-[9px]" : "h-10 w-10 rounded-xl";
  const icon = compact ? 14 : 17;

  return (
    <button
      type="button"
      aria-label={state === "recording" ? "Stop recording" : "Speak"}
      aria-pressed={state === "recording"}
      title={state === "recording" ? "Tap to stop" : "Tap to speak"}
      disabled={disabled || state === "transcribing"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (state === "recording") stopRecording();
        else void startRecording();
      }}
      className={`inline-flex shrink-0 items-center justify-center ${size} transition-colors ${
        state === "recording"
          ? "bg-red-d text-white shadow-card animate-pulse"
          : state === "transcribing"
            ? "bg-line text-ink-3"
            : "bg-transparent text-ink-2 hover:bg-line/70 hover:text-ink"
      } ${busy && state !== "recording" ? "opacity-60" : ""}`}
    >
      <MicIcon size={icon} />
    </button>
  );
}
