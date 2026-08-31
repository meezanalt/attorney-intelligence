import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { Search, ArrowRight, MapPin, Briefcase, X } from 'lucide-react';
import AttorneySearchLoading from 'src/components/attorney-search-loading-state';
import { consumeAttorneySearchStream } from 'src/lib/chat/consume-attorney-search-stream';
import type {
  AttorneySearchResultItem,
  AttorneySearchStage,
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
  if (score >= 90) return { ring: 'var(--garnet)', label: 'Strongest match' };
  if (score >= 75) return { ring: 'var(--brass)', label: 'Strong match' };
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

const FIRM_NAME = process.env.NEXT_PUBLIC_FIRM_NAME || 'Altudo';
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
  const [loadingStage, setLoadingStage] = useState<AttorneySearchStage>('reading');
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
    setLoadingStage('reading');
    setResults([]);
    setErrorMessage('');
    setEmptyReason(undefined);
    setScored(true);

    try {
      const res = await fetch('/api/attorney-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
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

      const contentType = res.headers.get('content-type') || '';

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(data.error || 'Search failed. Please try again.');
        setPhase('error');
        return;
      }

      if (!contentType.includes('text/event-stream') || !res.body) {
        setErrorMessage('Search failed. Please try again.');
        setPhase('error');
        return;
      }

      const data = await consumeAttorneySearchStream(res.body, {
        signal: controller.signal,
        onStage: (stage) => setLoadingStage(stage),
      });

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
      setErrorMessage(
        err instanceof Error && err.message
          ? err.message
          : 'We could not reach the matching service. Please try again.'
      );
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
    setLoadingStage('reading');
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const showHero = phase === 'idle' || phase === 'error' || phase === 'empty';
  const showLoading = phase === 'loading';
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
          --ink: #0a0a0a;
          --ink-soft: #333333;
          --paper: #f8f8f8;
          --paper-raised: #ffffff;
          --slate: #6b6b6b;
          --slate-light: #9e9e9e;
          --garnet: #ffca07;
          --garnet-soft: #fffbe6;
          --brass: #0a0a0a;
          --brass-soft: #f0f0f0;
          --line: #e0e0e0;
          --primary-beige: #f5f5f5;
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
          background: #0a0a0a;
          border-bottom: 3px solid var(--garnet);
        }
        .attorney-search-page .header-logo {
          display: flex;
          align-items: center;
          flex-shrink: 0;
          text-decoration: none;
        }
        .attorney-search-page .header-logo .logo-img {
          height: 30px;
          width: auto;
          display: block;
        }
        .attorney-search-page .profile-initials {
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--gazpacho), Georgia, serif;
          font-size: 1.35rem;
          font-weight: 700;
          color: var(--ink);
          letter-spacing: 0.04em;
        }
        .attorney-search-page .kicker {
          font-family: var(--gazpacho), 'Gazpacho', serif;
          font-size: 1.5rem;
          font-weight: 700;
          letter-spacing: 0.01em;
          color: var(--garnet);
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
          color: #0a0a0a;
          border: none;
          border-radius: 8px;
          padding: 10px 18px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: background 0.15s ease;
        }
        .attorney-search-page .search-btn:hover { background: #e6b600; }
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
        }        @keyframes attorney-search-spin {
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
          .attorney-search-page .header-logo .logo-img {
            height: 34px;
          }        }

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
        <a href="/" className="header-logo" aria-label="Altudo home">
          <svg className="logo-img" viewBox="0 0 400 101" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
            <g transform="translate(0 0.008)">
              <path d="M731.4,92.758a22.007,22.007,0,0,1-12.887,7.9c-8.683,1.747-16.58-.376-23.693-5.444-9.375-6.677-12.554-16.286-12.465-27.3.089-11.278,4.452-20.277,14.081-26.6,10.463-6.869,25.32-6.451,34.429,2.545a1.133,1.133,0,0,0,.323.152c.528-.273.216-.751.216-1.109q-.011-19.484-.064-38.969c0-2.623.252-2.85,2.892-2.846q8.118.016,16.24,0c2.435,0,2.619.163,2.616,2.687q-.016,39.421-.039,78.845c0,4.81-.014,9.623.06,14.432.025,1.613-.521,2.251-2.2,2.229-5.834-.071-11.671-.053-17.505,0-1.538.014-2.222-.461-2.038-2.109A42.141,42.141,0,0,0,731.4,92.758Zm-26.72-23.973A13.609,13.609,0,0,0,718.3,82.611c7.361.018,13.929-6.479,13.911-13.759s-6.419-13.571-13.819-13.6A13.6,13.6,0,0,0,704.682,68.785Z" transform="translate(-440.512 -0.709)" fill="#ffffff"/>
              <path d="M49.219,108.923c0-1.457.071-2.587-.018-3.7-.11-1.375.354-1.978,1.808-1.967,6.135.046,12.27.035,18.405,0,1.141-.007,1.637.369,1.591,1.567-.071,1.8-.011,3.608-.011,5.412q.021,25.614.039,51.228c0,2.254-.291,2.559-2.431,2.555q-8.57-.005-17.14-.014c-2.148,0-2.339-.255-2.236-2.435.057-1.191.011-2.382.011-3.842A24.116,24.116,0,0,1,35.042,165.5c-11.749,2.091-25.1-4.292-30.573-14.872-6.738-13.018-5.823-25.685,2.513-37.682,8.084-11.636,25.876-15.1,37.9-7.578A29.425,29.425,0,0,1,49.219,108.923ZM36.268,147.357A14.023,14.023,0,0,0,50.045,133.75a13.839,13.839,0,0,0-13.752-13.745,13.685,13.685,0,0,0-13.823,13.61A13.937,13.937,0,0,0,36.268,147.357Z" transform="translate(0 -65.454)" fill="#ffffff"/>
              <path d="M959.716,65.439c-6.759-.106-13.16-1.014-19.089-4.009-11.037-5.572-16.963-14.684-17.774-26.9-1-15.028,7.914-26.575,21.971-31.785,12.731-4.717,24.817-3.275,36.311,3.636,10.828,6.511,15.364,16.378,14.482,28.761-1.056,14.826-10.218,25.1-25.582,29.041a44.377,44.377,0,0,1-5.3,1.049A22.234,22.234,0,0,1,959.716,65.439ZM945.532,32.655a13.757,13.757,0,1,0,13.826-13.684A13.757,13.757,0,0,0,945.532,32.655Z" transform="translate(-595.722 0)" fill="#ffc90d"/>
              <path d="M533.129,128.26c0,5.713.018,11.427,0,17.14-.039,11.664-5.486,19.107-16.658,22.208a56.088,56.088,0,0,1-33.886-.836c-7.964-2.743-12.334-8.747-13.706-17.012a53.936,53.936,0,0,1-.429-8.815q-.032-15.965-.007-31.934c0-2.3.128-2.4,2.481-2.392q8.028.016,16.059.007c3.151-.007,3.151-.025,3.147,3.2q-.011,14.705-.018,29.407a22.784,22.784,0,0,0,.528,6.093c1.386,5.033,5.6,6.855,11.037,6.674,6.2-.206,9.566-3.491,9.885-9.669.5-9.729.181-19.479.184-29.219,0-1.563-.032-3.126-.025-4.689a1.652,1.652,0,0,1,1.907-1.847c5.894.021,11.788.039,17.682.011,1.577-.007,1.878.836,1.871,2.183-.035,6.493-.014,12.99-.014,19.486Z" transform="translate(-302.409 -68.811)" fill="#ffffff"/>
              <path d="M261.115,50.236V96.808c0,2.389-.043,2.428-2.414,2.428q-8.395.005-16.789.011c-2.1,0-2.417-.3-2.417-2.4q-.005-46.571,0-93.139c0-2.3.351-2.651,2.562-2.651,5.6,0,11.193.05,16.789-.021,1.684-.021,2.318.471,2.311,2.265C261.09,18.948,261.115,34.592,261.115,50.236Z" transform="translate(-154.611 -0.675)" fill="#ffffff"/>
              <path d="M358.918,112.7c0,6.436-.043,12.873.028,19.309.018,1.68-.61,2.212-2.222,2.2q-8.666-.085-17.328,0c-1.652.018-2.19-.592-2.183-2.233.064-12.632.057-25.267.071-37.9,0-2.729-.2-2.91-2.864-2.63-.418.043-.84.06-1.262.071-2.811.092-3.193-.379-3.122-3.215.1-4.147.089-8.3.1-12.447.007-2.265.284-2.651,2.446-2.4,5.455.642,4.849-.447,4.717-4.615-.124-3.966-.018-7.939-.082-11.909-.021-1.269.578-1.758,1.723-1.761q9.112-.021,18.228-.011c1.265,0,1.779.638,1.762,1.939-.057,4.813.014,9.626-.074,14.436-.028,1.52.482,2,1.971,1.946,2.764-.11,5.536-.021,8.3-.089,1.4-.035,2.017.581,1.964,1.928-.191,4.749-.167,9.5-.011,14.251.046,1.393-.666,1.9-2.017,1.868-2.765-.074-5.536-.021-8.3-.113-1.4-.046-1.91.461-1.9,1.882.053,6.5.021,12.993.021,19.49Z" transform="translate(-213.059 -35.615)" fill="#ffffff"/>
            </g>
          </svg>
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
                  ? 'We scored available attorney profiles against your matter, but none cleared our match threshold. Try refining your description, or adjust the practice and location filters.'
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

      {showLoading && <AttorneySearchLoading stage={loadingStage} />}

      {showResults && (
        <div className="results-wrap">
          <div className="recap">
            <p className="recap-text">
              Matches for <strong>&ldquo;{activeQuery}&rdquo;</strong>
              {!scored && (
                <>
                  {' '}
                  <span style={{ color: 'var(--slate-light)' }}>
                    (AI ranking unavailable — showing discovery matches without scores)
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
