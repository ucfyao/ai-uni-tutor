'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Extend Window interface for webkit prefix
interface SpeechRecognitionEvent extends Event {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: any;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

function getSpeechRecognitionConstructor(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export interface UseSpeechRecognitionOptions {
  /** BCP-47 language code, e.g. 'zh-CN' or 'en-US' */
  lang?: string;
  /** Called with the latest transcript (final + interim) */
  onTranscript?: (text: string) => void;
  /** Called when an error occurs, such as 'not-allowed' for missing permissions */
  onError?: (error: string, message: string) => void;
}

export interface UseSpeechRecognitionReturn {
  /** Whether the browser supports Web Speech API */
  isSupported: boolean;
  /** Whether currently listening */
  isListening: boolean;
  /** Start listening */
  start: () => void;
  /** Stop listening */
  stop: () => void;
  /** Toggle listening on/off */
  toggle: () => void;
}

export function useSpeechRecognition({
  lang = 'en-US',
  onTranscript,
  onError,
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);
  const finalTranscriptRef = useRef('');

  // Keep callback ref up to date
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onErrorRef.current = onError;
  }, [onTranscript, onError]);

  // Check support only after mount to prevent SSR hydration mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsSupported(getSpeechRecognitionConstructor() !== null);
    }
  }, []);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const start = useCallback(async () => {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      console.error('[SpeechRecognition] Browser does not support SpeechRecognition');
      return;
    }

    // Try to explicitly request microphone permissions to trigger the browser popup
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.warn('[SpeechRecognition] Failed to get user media permissions:', err);
      setIsListening(false);
      if (onErrorRef.current) {
        onErrorRef.current('not-allowed', 'Microphone permission was denied by the user.');
      }
      return;
    }

    // Stop any existing instance
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    finalTranscriptRef.current = '';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      finalTranscriptRef.current = finalTranscript;
      const combined = finalTranscript + interimTranscript;

      if (onTranscriptRef.current && combined) {
        onTranscriptRef.current(combined);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed') {
        console.warn('[SpeechRecognition] Permission denied:', event.error);
      } else {
        console.error('[SpeechRecognition] Error occurred:', event.error, event.message);
      }

      if (onErrorRef.current) {
        onErrorRef.current(event.error, event.message);
      }

      // 'no-speech' and 'aborted' are expected in some cases
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('[SpeechRecognition] Error:', event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.error('[SpeechRecognition] Exception during start():', e);
    }
  }, [lang]);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    start,
    stop,
    toggle,
  };
}
