import React from 'react';
import Head from 'next/head';
import type { AttorneySearchStage } from 'src/lib/chat/attorney-search-types';

const STAGES: { key: AttorneySearchStage; label: string }[] = [
  { key: 'reading', label: 'Reading your matter' },
  { key: 'searching', label: 'Searching attorney records' },
  { key: 'evaluating', label: 'Evaluating fit' },
  { key: 'ranking', label: 'Ranking matches' },
];

function stageIndex(stage: AttorneySearchStage): number {
  const i = STAGES.findIndex((s) => s.key === stage);
  return i >= 0 ? i : 0;
}

function SkeletonCard({ delay }: { delay: number }) {
  return (
    <div className="skel-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="skel-top">
        <div className="skel-docket" />
        <div className="skel-seal">
          <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
            <circle cx="38" cy="38" r="34" fill="none" stroke="var(--line)" strokeWidth="2" />
            <circle
              cx="38"
              cy="38"
              r="34"
              fill="none"
              stroke="var(--garnet)"
              strokeWidth="2.5"
              strokeDasharray="14 10"
              strokeLinecap="round"
              className="seal-spin"
            />
          </svg>
        </div>
      </div>
      <div className="skel-bar skel-name" />
      <div className="skel-bar skel-title" />
      <div className="skel-tags">
        <div className="skel-tag" />
        <div className="skel-tag" />
      </div>
      <div className="skel-finding">
        <div className="skel-bar skel-line" />
        <div className="skel-bar skel-line short" />
      </div>
    </div>
  );
}

export default function AttorneySearchLoading({ stage }: { stage: AttorneySearchStage }) {
  const activeStage = stageIndex(stage);

  return (
    <div className="attorney-search-loading">
      <Head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </Head>
      <style>{`
        .attorney-search-loading {
          --ink: #111933;
          --ink-soft: #3a3f5c;
          --paper: #faf5ef;
          --paper-raised: #ffffff;
          --slate: #707585;
          --slate-light: #9a979d;
          --garnet: #011b6d;
          --garnet-soft: #e8ecf5;
          --brass: #5363ee;
          --line: #e5e1da;
          background: var(--paper);
          font-family: 'IBM Plex Sans', sans-serif;
          color: var(--ink);
          padding: 56px 48px;
          max-width: 920px;
          margin: 0 auto;
          box-sizing: border-box;
        }
        .attorney-search-loading *,
        .attorney-search-loading *::before,
        .attorney-search-loading *::after {
          box-sizing: border-box;
        }

        .attorney-search-loading .scan-header { text-align: center; margin-bottom: 40px; }
        .attorney-search-loading .scan-ring-wrap {
          position: relative; width: 88px; height: 88px; margin: 0 auto 20px;
        }
        .attorney-search-loading .scan-ring-wrap svg { animation: asl-rotate 2.4s linear infinite; }
        @keyframes asl-rotate { to { transform: rotate(360deg); } }
        .attorney-search-loading .scan-headline {
          font-family: 'Fraunces', serif; font-size: 22px; font-weight: 500; margin: 0 0 6px;
        }
        .attorney-search-loading .scan-sub { font-size: 13.5px; color: var(--slate); margin: 0; }

        .attorney-search-loading .stepper {
          display: flex; justify-content: center; gap: 28px; margin-bottom: 44px; flex-wrap: wrap;
        }
        .attorney-search-loading .step { display: flex; align-items: center; gap: 8px; }
        .attorney-search-loading .step-dot {
          width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid var(--line);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          transition: all 0.3s ease;
        }
        .attorney-search-loading .step.active .step-dot { border-color: var(--garnet); }
        .attorney-search-loading .step.active .step-dot::after {
          content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--garnet);
          animation: asl-pulse 1s ease-in-out infinite;
        }
        @keyframes asl-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .attorney-search-loading .step.done .step-dot { border-color: var(--brass); background: var(--brass); }
        .attorney-search-loading .step.done .step-dot::after {
          content: '✓'; color: white; font-size: 11px; font-weight: 700; line-height: 1;
          animation: none; width: auto; height: auto; background: none; border-radius: 0;
        }
        .attorney-search-loading .step-label {
          font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; letter-spacing: 0.03em;
          color: var(--slate-light); transition: color 0.3s ease;
        }
        .attorney-search-loading .step.active .step-label,
        .attorney-search-loading .step.done .step-label { color: var(--ink); }

        .attorney-search-loading .card-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px;
        }
        @media (max-width: 720px) {
          .attorney-search-loading .card-grid { grid-template-columns: 1fr; }
        }

        .attorney-search-loading .skel-card {
          background: var(--paper-raised); border: 1px solid var(--line); border-radius: 14px;
          padding: 22px; opacity: 0; animation: asl-rise 0.5s ease forwards;
        }
        @keyframes asl-rise {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .attorney-search-loading .skel-card { animation: none; opacity: 1; }
          .attorney-search-loading .scan-ring-wrap svg,
          .attorney-search-loading .seal-spin,
          .attorney-search-loading .skel-bar::after,
          .attorney-search-loading .skel-tag::after {
            animation: none !important;
          }
        }

        .attorney-search-loading .skel-top {
          display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;
        }
        .attorney-search-loading .skel-docket {
          width: 64px; height: 10px; border-radius: 2px; margin-top: 10px;
          background: var(--line);
        }
        .attorney-search-loading .seal-spin {
          animation: asl-rotate 1.6s linear infinite; transform-origin: 38px 38px;
        }

        .attorney-search-loading .skel-bar {
          height: 12px; border-radius: 3px; position: relative; overflow: hidden;
          background: var(--line);
        }
        .attorney-search-loading .skel-bar::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent);
          animation: asl-shimmer 1.6s ease-in-out infinite;
        }
        @keyframes asl-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .attorney-search-loading .skel-name { width: 62%; height: 18px; margin: 12px 0 8px; }
        .attorney-search-loading .skel-title { width: 48%; margin-bottom: 16px; }
        .attorney-search-loading .skel-tags { display: flex; gap: 8px; margin-bottom: 18px; }
        .attorney-search-loading .skel-tag {
          width: 76px; height: 22px; border-radius: 999px; background: var(--line);
          position: relative; overflow: hidden;
        }
        .attorney-search-loading .skel-tag::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent);
          animation: asl-shimmer 1.6s ease-in-out infinite;
        }
        .attorney-search-loading .skel-finding {
          border-left: 2px solid var(--garnet-soft); padding-left: 13px;
        }
        .attorney-search-loading .skel-line { width: 100%; height: 10px; margin-bottom: 8px; }
        .attorney-search-loading .skel-line.short { width: 70%; margin-bottom: 0; }

        @media (max-width: 720px) {
          .attorney-search-loading { padding: 40px 20px; }
        }
      `}</style>

      <div className="scan-header">
        <div className="scan-ring-wrap">
          <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true">
            <circle cx="44" cy="44" r="38" fill="none" stroke="var(--line)" strokeWidth="2" />
            <circle
              cx="44"
              cy="44"
              r="38"
              fill="none"
              stroke="var(--garnet)"
              strokeWidth="2.5"
              strokeDasharray="60 179"
              strokeLinecap="round"
            />
            <circle
              cx="44"
              cy="44"
              r="28"
              fill="none"
              stroke="var(--brass)"
              strokeWidth="1"
              strokeDasharray="2 4"
              opacity="0.6"
            />
          </svg>
        </div>
        <h2 className="scan-headline">Reviewing your matter</h2>
        <p className="scan-sub">Matching your description against attorney experience firm-wide</p>
      </div>

      <div className="stepper" role="status" aria-live="polite" aria-atomic="true">
        {STAGES.map((s, i) => (
          <div
            key={s.key}
            className={`step ${i < activeStage ? 'done' : i === activeStage ? 'active' : ''}`}
          >
            <div className="step-dot" />
            <span className="step-label">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="card-grid">
        <SkeletonCard delay={0} />
        <SkeletonCard delay={90} />
        <SkeletonCard delay={180} />
      </div>
    </div>
  );
}
