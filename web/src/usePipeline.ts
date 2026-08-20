"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  OUTCOME_HEADLINE,
  type DoneMessage,
  type MetaMessage,
  type PipelineMessage,
  type PipelineStep,
  type QuestionsMessage,
  type StepMessage,
} from "../../lib/pipelineWire";
import { readSse, startPipeline, type PipelineBody } from "./elestar-api";

export { OUTCOME_HEADLINE };

export interface StageState {
  message: StepMessage;
}

export function usePipeline() {
  const [running, setRunning] = useState(false);
  const [meta, setMeta] = useState<MetaMessage | null>(null);
  const [stages, setStages] = useState<Partial<Record<PipelineStep, StageState>>>({});
  const [active, setActive] = useState<PipelineStep | null>(null);
  const [questions, setQuestions] = useState<QuestionsMessage | null>(null);
  const [done, setDone] = useState<DoneMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastBody = useRef<PipelineBody | null>(null);
  const abort = useRef<AbortController | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    return () => {
      cancelled.current = true;
      abort.current?.abort();
    };
  }, []);

  const apply = useCallback((message: PipelineMessage) => {
    switch (message.kind) {
      case "meta":
        setMeta(message);
        break;
      case "step":
        setStages((prev) => ({ ...prev, [message.step]: { message } }));
        setActive(message.step);
        break;
      case "questions":
        setQuestions(message);
        break;
      case "done":
        setDone(message);
        setActive(null);
        break;
    }
  }, []);

  const run = useCallback(
    async (body: PipelineBody) => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      lastBody.current = body;
      setRunning(true);
      setStages({});
      setActive(null);
      setQuestions(null);
      setDone(null);
      setError(null);
      setMeta(null);

      try {
        const stream = await startPipeline(body);
        await readSse(stream, apply, controller.signal);
      } catch (err) {
        if (!cancelled.current && !controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Lost connection while processing. Nothing was published.");
        }
      } finally {
        if (!cancelled.current) setRunning(false);
      }
    },
    [apply],
  );

  const answer = useCallback(
    async (priorAnswers: Record<string, string>) => {
      const prev = lastBody.current ?? {};
      await run({ ...prev, priorAnswers });
    },
    [run],
  );

  const cancel = useCallback(() => {
    abort.current?.abort();
    setRunning(false);
  }, []);

  return { running, meta, stages, active, questions, done, error, run, answer, cancel };
}
