"use client";

import type { ReviewStepData } from "../../../lib/pipelineWire";

export function PatternReviewPanel({ review }: { review?: ReviewStepData }) {
  if (!review) return null;

  return (
    <div className="mt-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-2" style={{ color: "var(--navy)" }}>
        Pattern review · cannot un-publish
      </p>
      <p className="text-[13px] leading-relaxed mb-3" style={{ color: "var(--muted-foreground)" }}>
        {review.review.reviewerNote}
      </p>
      {review.review.signals.length > 0 && (
        <ul className="space-y-1.5">
          {review.review.signals.map((signal) => (
            <li key={signal.signal} className="flex gap-2 text-[13px]">
              <span className="font-mono text-[10px] uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
                {signal.severity}
              </span>
              <span>{signal.signal}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
