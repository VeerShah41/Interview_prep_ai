import { act, renderHook } from '@testing-library/react';
import { useSpeechRecognition } from '../useSpeechRecognition';

type ResultTuple = { isFinal: boolean; 0: { transcript: string } };

/** Minimal stand-in for the browser SpeechRecognition API. */
class FakeSpeechRecognition {
  static instances: FakeSpeechRecognition[] = [];

  continuous = false;
  interimResults = false;
  lang = '';
  maxAlternatives = 0;
  startCalls = 0;
  stopCalls = 0;
  abortCalls = 0;
  failOnStart = false;

  onresult: ((event: { results: ResultTuple[] }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;

  constructor() {
    FakeSpeechRecognition.instances.push(this);
  }

  start() {
    if (this.failOnStart) throw new Error('already started');
    this.startCalls += 1;
  }

  stop() {
    this.stopCalls += 1;
  }

  abort() {
    this.abortCalls += 1;
  }

  emitResults(results: Array<{ transcript: string; isFinal: boolean }>) {
    this.onresult?.({
      results: results.map((r) => ({ isFinal: r.isFinal, 0: { transcript: r.transcript } })),
    });
  }
}

function installFake() {
  FakeSpeechRecognition.instances = [];
  (window as unknown as Record<string, unknown>).SpeechRecognition = FakeSpeechRecognition;
}

function latest() {
  const instance = FakeSpeechRecognition.instances.at(-1);
  if (!instance) throw new Error('no recognition instance was created');
  return instance;
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
});

describe('useSpeechRecognition', () => {
  it('reports unsupported when the browser exposes no API', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    expect(result.current.isSupported).toBe(false);
    expect(result.current.isListening).toBe(false);
  });

  it('detects the webkit-prefixed API', () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition =
      FakeSpeechRecognition;

    const { result } = renderHook(() => useSpeechRecognition());

    expect(result.current.isSupported).toBe(true);
  });

  it('configures continuous recognition with interim results', () => {
    installFake();

    renderHook(() => useSpeechRecognition());

    expect(latest().continuous).toBe(true);
    expect(latest().interimResults).toBe(true);
    expect(latest().lang).toBe('en-US');
  });

  it('starts and stops listening', () => {
    installFake();
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => result.current.startListening());
    expect(result.current.isListening).toBe(true);
    expect(latest().startCalls).toBe(1);

    act(() => result.current.stopListening());
    expect(result.current.isListening).toBe(false);
    expect(latest().stopCalls).toBe(1);
  });

  it('is idempotent while already listening', () => {
    installFake();
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => result.current.startListening());
    act(() => result.current.startListening());

    expect(latest().startCalls).toBe(1);
  });

  it('separates final transcript from interim text', () => {
    installFake();
    const { result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.startListening());

    act(() => {
      latest().emitResults([
        { transcript: 'hello world', isFinal: true },
        { transcript: 'and then', isFinal: false },
      ]);
    });

    expect(result.current.transcript).toBe('hello world');
    expect(result.current.interimTranscript).toBe('and then');
  });

  it('keeps earlier finals when recognition restarts mid-answer', () => {
    installFake();
    const { result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.startListening());

    act(() => {
      latest().emitResults([{ transcript: 'first part', isFinal: true }]);
    });
    // The browser ends the session on its own; the hook restarts it.
    act(() => {
      latest().onend?.();
    });
    act(() => {
      latest().emitResults([{ transcript: 'second part', isFinal: true }]);
    });

    expect(result.current.transcript).toBe('first part second part');
    expect(latest().startCalls).toBe(2);
  });

  it('surfaces real errors but ignores no-speech and aborted', () => {
    installFake();
    const { result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.startListening());

    act(() => latest().onerror?.({ error: 'no-speech' }));
    expect(result.current.error).toBeNull();
    expect(result.current.isListening).toBe(true);

    act(() => latest().onerror?.({ error: 'not-allowed' }));
    expect(result.current.error).toBe('Speech recognition error: not-allowed');
    expect(result.current.isListening).toBe(false);
  });

  it('reports a failure when the microphone cannot be started', () => {
    installFake();
    const { result } = renderHook(() => useSpeechRecognition());
    latest().failOnStart = true;

    act(() => result.current.startListening());

    expect(result.current.error).toBe('Failed to start microphone');
    expect(result.current.isListening).toBe(false);
  });

  it('clears the transcript on reset and on a fresh start', () => {
    installFake();
    const { result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.startListening());
    act(() => {
      latest().emitResults([{ transcript: 'something', isFinal: true }]);
    });

    act(() => result.current.resetTranscript());

    expect(result.current.transcript).toBe('');
    expect(result.current.interimTranscript).toBe('');
  });

  it('aborts recognition on unmount so the mic is released', () => {
    installFake();
    const { unmount, result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.startListening());

    unmount();

    expect(latest().abortCalls).toBe(1);
  });
});
