import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { Search, ArrowRight, MapPin, Briefcase, X } from 'lucide-react';
import type {
  AttorneySearchResponse,
  AttorneySearchResultItem,
} from 'src/lib/chat/attorney-search-types';

const EXAMPLES = [
  'Selling my company in Chicago…',
  'A former employee is suing us for wrongful termination…',
  'Need help reviewing a commercial lease…',
  'A competitor is infringing our patent…',
];

const ANY_PRACTICE = 'Any practice';
const ANY_LOCATION = 'Any location';

type Phase = 'idle' | 'loading' | 'results' | 'error' | 'empty';

function tier(score: number) {
  if (score >= 90) return { ring: 'var(--brass)', label: 'Strongest match' };
  if (score >= 75) return { ring: 'var(--garnet)', label: 'Strong match' };
  return { ring: 'var(--slate)', label: 'Possible match' };
}

function Seal({ score }: { score: number }) {
  const t = tier(score);
  const c = 2 * Math.PI * 34;
  const offset = c - (score / 100) * c;
  return (
    <div className="seal" aria-label={`Match score ${score} percent`}>
      <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
        <circle cx="38" cy="38" r="34" fill="none" stroke="var(--line)" strokeWidth="2" />
        <circle
          cx="38"
          cy="38"
          r="34"
          fill="none"
          stroke={t.ring}
          strokeWidth="2.5"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 38 38)"
          className="seal-ring"
        />
        <circle
          cx="38"
          cy="38"
          r="27"
          fill="none"
          stroke={t.ring}
          strokeWidth="1"
          strokeDasharray="2 3"
          opacity="0.5"
        />
      </svg>
      <div className="seal-inner">
        <span className="seal-score">{score}</span>
        <span className="seal-pct">%</span>
      </div>
    </div>
  );
}

function ProfilePhoto({ name, photoUrl }: { name: string; photoUrl?: string }) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="profile-photo" src={photoUrl} alt={name} width={88} height={104} />
    );
  }
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="profile-photo profile-initials" aria-label={name}>
      {initials}
    </div>
  );
}

function ResultCard({
  r,
  index,
  scored,
}: {
  r: AttorneySearchResultItem;
  index: number;
  scored: boolean;
}) {
  const showSeal = scored && typeof r.matchScore === 'number';
  const t = showSeal ? tier(r.matchScore!) : null;
  const profileHref = r.url || '#';

  return (
    <div className="card" style={{ animationDelay: `${index * 90}ms` }}>
      <div className="card-top">
        <span className="docket">MATCH NO. {String(index + 1).padStart(2, '0')}</span>
        {showSeal ? <Seal score={r.matchScore!} /> : null}
      </div>
      <div className="card-identity">
        <ProfilePhoto name={r.name} photoUrl={r.photoUrl} />
        <div className="card-identity-text">
          <h3 className="card-name">{r.name}</h3>
          <p className="card-title">{r.title}</p>
        </div>
      </div>
      <div className="card-tags">
        {r.practice ? (
          <span className="tag">
            <Briefcase size={12} aria-hidden="true" /> {r.practice}
          </span>
        ) : null}
        {r.location ? (
          <span className="tag">
            <MapPin size={12} aria-hidden="true" /> {r.location}
          </span>
        ) : null}
      </div>
      {r.finding ? (
        <div className="finding">
          <span className="finding-label">Finding</span>
          <p>{r.finding}</p>
        </div>
      ) : null}
      <div className="card-footer">
        {t ? (
          <span className="tier-label" style={{ color: t.ring }}>
            {t.label}
          </span>
        ) : (
          <span className="tier-label" style={{ color: 'var(--slate)' }}>
            Suggested match
          </span>
        )}
        <a
          href={profileHref}
          className="view-link"
          target={profileHref.startsWith('http') ? '_blank' : undefined}
          rel={profileHref.startsWith('http') ? 'noopener noreferrer' : undefined}
        >
          View profile <ArrowRight size={14} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

const FIRM_NAME = process.env.NEXT_PUBLIC_FIRM_NAME || 'Harrow & Vance';
const FIRM_PRODUCT = process.env.NEXT_PUBLIC_FIRM_PRODUCT || 'Attorney Intelligence';

export default function AttorneySearchPage() {
  const [query, setQuery] = useState('');
  const [practice, setPractice] = useState(ANY_PRACTICE);
  const [location, setLocation] = useState(ANY_LOCATION);
  const [practices, setPractices] = useState<string[]>([ANY_PRACTICE]);
  const [locations, setLocations] = useState<string[]>([ANY_LOCATION]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [results, setResults] = useState<AttorneySearchResultItem[]>([]);
  const [scored, setScored] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [emptyReason, setEmptyReason] = useState<string | undefined>();
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [activeQuery, setActiveQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/attorney-search/filters');
        if (!res.ok) return;
        const data = (await res.json()) as { practices?: string[]; locations?: string[] };
        if (cancelled) return;
        setPractices([ANY_PRACTICE, ...(data.practices ?? [])]);
        setLocations([ANY_LOCATION, ...(data.locations ?? [])]);
      } catch {
        // Keep default Any-* options
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'idle') return;
    const iv = setInterval(() => setPlaceholderIdx((i) => (i + 1) % EXAMPLES.length), 3200);
    return () => clearInterval(iv);
  }, [phase]);

  async function runSearch(text?: string) {
    const q = (text ?? query).trim();
    if (!q) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setQuery(q);
    setActiveQuery(q);
    setPhase('loading');
    setResults([]);
    setErrorMessage('');
    setEmptyReason(undefined);

    try {
      const res = await fetch('/api/attorney-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          practice,
          location,
        }),
        signal: controller.signal,
      });

      if (res.status === 429) {
        setErrorMessage('Too many searches right now. Please wait a moment and try again.');
        setPhase('error');
        return;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(data.error || 'Search failed. Please try again.');
        setPhase('error');
        return;
      }

      const data = (await res.json()) as AttorneySearchResponse;
      setScored(data.scored);
      setResults(data.results);
      setEmptyReason(data.emptyReason);

      if (!data.results.length) {
        setPhase('empty');
      } else {
        setPhase('results');
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setErrorMessage('We could not reach the matching service. Please try again.');
      setPhase('error');
    }
  }

  function reset() {
    abortRef.current?.abort();
    setPhase('idle');
    setResults([]);
    setQuery('');
    setActiveQuery('');
    setPractice(ANY_PRACTICE);
    setLocation(ANY_LOCATION);
    setErrorMessage('');
    setEmptyReason(undefined);
    setScored(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const showHero =
    phase === 'idle' || phase === 'loading' || phase === 'error' || phase === 'empty';
  const showResults = phase === 'results';

  return (
    <div className="page attorney-search-page">
      <Head>
        <title>
          {FIRM_PRODUCT} | {FIRM_NAME}
        </title>
        <meta
          name="description"
          content="Describe your legal matter in plain English and get ranked attorney matches with AI reasoning."
        />
      </Head>

      <style>{`
        :root {
          --ink: #111933;
          --ink-soft: #3a3f5c;
          --paper: #faf5ef;
          --paper-raised: #ffffff;
          --slate: #707585;
          --slate-light: #9a979d;
          --garnet: #011b6d;
          --garnet-soft: #e8ecf5;
          --brass: #5363ee;
          --brass-soft: #eef0fd;
          --line: #e5e1da;
          --primary-beige: #f4ede4;
        }

        .attorney-search-page * { box-sizing: border-box; }

        .attorney-search-page {
          background: var(--paper);
          min-height: 100vh;
          font-family: var(--font-poppins), 'Poppins', sans-serif;
          font-weight: 300;
          color: var(--ink);
        }

        .attorney-search-page button,
        .attorney-search-page input,
        .attorney-search-page select {
          font-family: inherit;
        }

        .attorney-search-page a:focus-visible,
        .attorney-search-page button:focus-visible,
        .attorney-search-page input:focus-visible,
        .attorney-search-page select:focus-visible {
          outline: 2px solid var(--garnet);
          outline-offset: 2px;
        }

        .attorney-search-page .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.125rem 48px;
          background: var(--ink);
          border-bottom: none;
        }
        .attorney-search-page .header-logo {
          display: block;
          flex-shrink: 0;
          color: #fff;
          text-decoration: none;
          font-weight: 700;
          font-size: 1.1rem;
          letter-spacing: 0.02em;
        }
        .attorney-search-page .profile-initials {
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--gazpacho), Georgia, serif;
          font-size: 1.35rem;
          font-weight: 700;
          color: var(--garnet);
          letter-spacing: 0.04em;
        }
        .attorney-search-page .kicker {
          font-family: var(--gazpacho), 'Gazpacho', serif;
          font-size: 1.5rem;
          font-weight: 700;
          letter-spacing: 0.01em;
          color: #ffffff;
        }

        .attorney-search-page .hero {
          padding: 72px 48px 56px;
          max-width: 780px;
          margin: 0 auto;
          text-align: center;
        }
        .attorney-search-page .eyebrow {
          font-family: var(--font-poppins), 'Poppins', sans-serif;
          font-size: 0.75rem;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--garnet);
          margin-bottom: 18px;
        }
        .attorney-search-page .headline {
          font-family: var(--gazpacho), 'Gazpacho', serif;
          font-weight: 700;
          font-size: 2.75rem;
          line-height: 1.15;
          margin: 0 0 16px;
          color: var(--ink);
        }
        .attorney-search-page .headline em {
          font-style: normal;
          color: var(--garnet);
        }
        .attorney-search-page .subhead {
          font-size: 1.0625rem;
          font-weight: 300;
          line-height: 1.6;
          color: var(--slate);
          max-width: 560px;
          margin: 0 auto 40px;
        }

        .attorney-search-page .search-box {
          background: var(--paper-raised);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 22px;
          text-align: left;
          box-shadow: 0 1px 2px rgba(18, 24, 43, 0.04);
        }
        .attorney-search-page .search-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .attorney-search-page .search-row svg {
          color: var(--slate-light);
          flex-shrink: 0;
        }
        .attorney-search-page .search-input {
          flex: 1;
          border: none;
          background: none;
          font-size: 17px;
          color: var(--ink);
          padding: 6px 0;
        }
        .attorney-search-page .search-input::placeholder {
          color: var(--slate-light);
          transition: opacity 0.4s ease;
        }
        .attorney-search-page .search-input:focus { outline: none; }
        .attorney-search-page .search-btn {
          background: var(--garnet);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 18px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: background 0.15s ease;
        }
        .attorney-search-page .search-btn:hover { background: #0e1530; }
        .attorney-search-page .search-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .attorney-search-page .filters {
          display: flex;
          gap: 10px;
          margin-top: 16px;
          flex-wrap: wrap;
        }
        .attorney-search-page .filter-select {
          border: 1px solid var(--line);
          background: var(--paper);
          color: var(--slate);
          font-size: 13px;
          padding: 7px 12px;
          border-radius: 999px;
          cursor: pointer;
          max-width: 100%;
        }

        .attorney-search-page .examples {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
          margin-top: 20px;
        }
        .attorney-search-page .example-chip {
          border: 1px solid var(--line);
          background: var(--paper-raised);
          color: var(--slate);
          font-size: 12.5px;
          padding: 7px 14px;
          border-radius: 999px;
          cursor: pointer;
          transition: border-color 0.15s ease, color 0.15s ease;
        }
        .attorney-search-page .example-chip:hover {
          border-color: var(--garnet);
          color: var(--garnet);
        }

        .attorney-search-page .loading-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
          padding: 80px 20px 100px;
        }
        .attorney-search-page .stamp {
          width: 56px;
          height: 56px;
          border: 2px solid var(--line);
          border-top-color: var(--garnet);
          border-radius: 50%;
          animation: attorney-search-spin 0.9s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .attorney-search-page .stamp {
            animation: none;
            border-top-color: var(--garnet);
          }
        }
        @keyframes attorney-search-spin {
          to { transform: rotate(360deg); }
        }
        .attorney-search-page .loading-text {
          font-family: var(--font-poppins), 'Poppins', sans-serif;
          font-size: 0.8125rem;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--slate);
        }

        .attorney-search-page .status-panel {
          margin-top: 28px;
          padding: 28px 24px;
          background: var(--primary-beige);
          text-align: center;
        }
        .attorney-search-page .status-panel p {
          margin: 0 0 16px;
          font-size: 1rem;
          font-weight: 300;
          line-height: 1.55;
          color: var(--ink-soft);
        }
        .attorney-search-page .status-actions {
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .attorney-search-page .results-wrap {
          max-width: 920px;
          margin: 0 auto;
          padding: 8px 48px 100px;
        }
        .attorney-search-page .recap {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 28px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--line);
        }
        .attorney-search-page .recap-text {
          font-size: 14px;
          font-weight: 300;
          color: var(--slate);
        }
        .attorney-search-page .recap-text strong {
          font-family: var(--gazpacho), 'Gazpacho', serif;
          color: var(--ink);
          font-weight: 500;
        }
        .attorney-search-page .reset-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: 1px solid var(--line);
          color: var(--slate);
          font-size: 13px;
          padding: 7px 13px;
          border-radius: 999px;
          cursor: pointer;
        }
        .attorney-search-page .reset-btn:hover {
          border-color: var(--ink);
          color: var(--ink);
        }

        .attorney-search-page .card-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
        }
        @media (max-width: 720px) {
          .attorney-search-page .card-grid { grid-template-columns: 1fr; }
        }

        .attorney-search-page .card {
          background: var(--paper-raised);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 22px;
          animation: attorney-search-rise 0.5s ease both;
        }
        @media (prefers-reduced-motion: reduce) {
          .attorney-search-page .card { animation: none; }
        }
        @keyframes attorney-search-rise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .attorney-search-page .card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 6px;
        }
        .attorney-search-page .docket {
          font-family: var(--font-poppins), 'Poppins', sans-serif;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.08em;
          color: var(--slate-light);
          padding-top: 6px;
        }

        .attorney-search-page .seal {
          position: relative;
          width: 76px;
          height: 76px;
          flex-shrink: 0;
        }
        .attorney-search-page .seal-ring {
          transition: stroke-dashoffset 0.8s ease;
        }
        .attorney-search-page .seal-inner {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: baseline;
          justify-content: center;
          font-family: var(--font-poppins), 'Poppins', sans-serif;
        }
        .attorney-search-page .seal-score {
          font-size: 20px;
          font-weight: 500;
          color: var(--ink);
        }
        .attorney-search-page .seal-pct {
          font-size: 11px;
          color: var(--ink);
          margin-left: 1px;
        }

        .attorney-search-page .card-identity {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          margin: 8px 0 14px;
        }
        .attorney-search-page .profile-photo {
          width: 88px;
          height: 104px;
          object-fit: cover;
          flex-shrink: 0;
          border: 1px solid var(--line);
          background: var(--primary-beige);
        }
        .attorney-search-page .card-identity-text {
          min-width: 0;
          padding-top: 4px;
        }
        .attorney-search-page .card-name {
          font-family: var(--gazpacho), 'Gazpacho', serif;
          font-size: 21px;
          font-weight: 500;
          margin: 0 0 4px;
        }
        .attorney-search-page .card-title {
          font-size: 13.5px;
          color: var(--slate);
          margin: 0;
        }

        .attorney-search-page .card-tags {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }
        .attorney-search-page .tag {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          color: var(--slate);
          border: 1px solid var(--line);
          padding: 4px 10px;
          border-radius: 999px;
        }

        .attorney-search-page .finding {
          border-left: 2px solid var(--garnet);
          padding-left: 13px;
          margin-bottom: 18px;
        }
        .attorney-search-page .finding-label {
          font-family: var(--font-poppins), 'Poppins', sans-serif;
          font-size: 10.5px;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--garnet);
          display: block;
          margin-bottom: 4px;
        }
        .attorney-search-page .finding p {
          font-size: 13.5px;
          font-weight: 300;
          line-height: 1.55;
          color: var(--ink-soft);
          margin: 0;
        }

        .attorney-search-page .card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .attorney-search-page .tier-label {
          font-size: 12px;
          font-weight: 500;
        }
        .attorney-search-page .view-link {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: var(--ink);
          text-decoration: none;
          font-weight: 500;
        }
        .attorney-search-page .view-link:hover {
          color: var(--garnet);
        }

        .attorney-search-page .disclaimer {
          text-align: center;
          font-size: 0.75rem;
          font-weight: 300;
          color: var(--slate-light);
          margin-top: 36px;
          max-width: 560px;
          margin-left: auto;
          margin-right: auto;
          line-height: 1.6;
        }

        @media (min-width: 768px) {
          .attorney-search-page .header {
            padding-top: 1.5rem;
            padding-bottom: 1.5rem;
          }
          .attorney-search-page .header-logo {
            font-size: 1.25rem;
          }
        }

        @media (max-width: 640px) {
          .attorney-search-page .header { padding: 1.125rem 22px; }
          .attorney-search-page .kicker { font-size: 1.25rem; }
          .attorney-search-page .hero { padding: 48px 22px 40px; }
          .attorney-search-page .headline { font-size: 2rem; }
          .attorney-search-page .results-wrap { padding: 8px 22px 80px; }
          .attorney-search-page .search-row { flex-wrap: wrap; }
          .attorney-search-page .search-btn { width: 100%; justify-content: center; }
        }
      `}</style>

      <header className="header">
        <a href="/" className="header-logo" aria-label={`${FIRM_NAME} home`}>
          <span>{FIRM_NAME}</span>
        </a>
        <span className="kicker">{FIRM_PRODUCT}</span>
      </header>

      {showHero && (
        <div className="hero">
          <div className="eyebrow">Matter-Based Attorney Matching</div>
          <h1 className="headline">
            Describe your matter.
            <br />
            <em>We&apos;ll find your counsel.</em>
          </h1>
          <p className="subhead">
            Tell us what&apos;s going on in plain English. Our matching engine reviews attorney
            experience across the firm and returns the strongest fits — ranked, and explained.
          </p>

          {phase === 'idle' && (
            <>
              <div className="search-box">
                <div className="search-row">
                  <Search size={18} aria-hidden="true" />
                  <input
                    ref={inputRef}
                    className="search-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                    placeholder={EXAMPLES[placeholderIdx]}
                    aria-label="Describe your legal matter"
                  />
                  <button className="search-btn" type="button" onClick={() => runSearch()}>
                    Find counsel <ArrowRight size={15} />
                  </button>
                </div>
                <div className="filters">
                  <select
                    className="filter-select"
                    value={practice}
                    onChange={(e) => setPractice(e.target.value)}
                    aria-label="Practice area filter"
                  >
                    {practices.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <select
                    className="filter-select"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    aria-label="Location filter"
                  >
                    {locations.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="examples">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    className="example-chip"
                    onClick={() => runSearch(ex.replace('…', ''))}
                  >
                    {ex.replace('…', '')}
                  </button>
                ))}
              </div>
            </>
          )}

          {phase === 'loading' && (
            <div className="loading-wrap">
              <div className="stamp" />
              <span className="loading-text">Reviewing your matter…</span>
            </div>
          )}

          {phase === 'error' && (
            <div className="status-panel">
              <p>{errorMessage}</p>
              <div className="status-actions">
                <button
                  type="button"
                  className="search-btn"
                  onClick={() => runSearch(activeQuery || query)}
                >
                  Try again
                </button>
                <button type="button" className="reset-btn" onClick={reset}>
                  <X size={13} /> New search
                </button>
              </div>
            </div>
          )}

          {phase === 'empty' && (
            <div className="status-panel">
              <p>
                {emptyReason === 'below_threshold'
                  ? 'We reviewed available attorney profiles but did not find a strong enough match for this matter. Try refining your description, or adjust the practice and location filters.'
                  : 'No attorney profiles matched this search. Try a broader description or different filters.'}
              </p>
              <div className="status-actions">
                <button type="button" className="reset-btn" onClick={reset}>
                  <X size={13} /> New search
                </button>
              </div>
              <p className="disclaimer" style={{ marginTop: 24 }}>
                Matches are generated by AI based on attorney profile content and are not a legal
                recommendation or evaluation of your matter. For guidance, please consult an
                attorney directly.
              </p>
            </div>
          )}
        </div>
      )}

      {showResults && (
        <div className="results-wrap">
          <div className="recap">
            <p className="recap-text">
              Matches for <strong>&ldquo;{activeQuery}&rdquo;</strong>
              {!scored && (
                <>
                  {' '}
                  <span style={{ color: 'var(--slate-light)' }}>
                    (ranking scores unavailable — showing discovery matches)
                  </span>
                </>
              )}
            </p>
            <button type="button" className="reset-btn" onClick={reset}>
              <X size={13} /> New search
            </button>
          </div>
          <div className="card-grid">
            {results.map((r, i) => (
              <ResultCard key={r.itemId} r={r} index={i} scored={scored} />
            ))}
          </div>
          <p className="disclaimer">
            Matches are generated by AI based on attorney profile content and are not a legal
            recommendation or evaluation of your matter. For guidance, please consult an attorney
            directly.
          </p>
        </div>
      )}
    </div>
  );
}
