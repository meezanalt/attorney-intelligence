import React from 'react';
import Head from 'next/head';
import type { GetStaticPaths, GetStaticProps } from 'next';
import { ArrowLeft, Briefcase, GraduationCap, MapPin, Scale, Sparkles } from 'lucide-react';
import {
  getDemoAttorneyBySlug,
  listDemoAttorneys,
  type DemoAttorneyProfile,
} from 'src/lib/chat/demo-attorneys';
import styles from './AttorneyBio.module.css';

const FIRM_NAME = process.env.NEXT_PUBLIC_FIRM_NAME || 'Harrow & Vance';

interface Props {
  attorney: DemoAttorneyProfile;
  firmName: string;
}

function splitMatters(experience: string): string[] {
  return experience
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

export default function AttorneyBioPage({ attorney, firmName }: Props) {
  const initials = attorney.name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const matters = attorney.experience ? splitMatters(attorney.experience) : [];
  const office = attorney.locations[0] || '';
  const primaryPractice = attorney.practices[0] || '';

  return (
    <div className={styles.page}>
      <Head>
        <title>
          {attorney.name} | {attorney.title} | {firmName}
        </title>
        <meta name="description" content={attorney.description} />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Poppins:wght@300;400;500;600;700&display=swap"
        />
      </Head>

      <header className={styles.header}>
        <a href="/attorney-search" className={styles.headerLogo} aria-label={`${firmName} home`}>
          {firmName}
        </a>
        <span className={styles.kicker}>Attorney Intelligence</span>
      </header>

      <section className={styles.hero} aria-labelledby="attorney-name">
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroInner}>
          <a className={styles.back} href="/attorney-search">
            <ArrowLeft size={16} aria-hidden="true" /> Back to search
          </a>

          <div className={styles.heroGrid}>
            <div className={styles.portraitWrap}>
              {attorney.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.portrait}
                  src={attorney.photoUrl}
                  alt={attorney.name}
                  width={400}
                  height={480}
                />
              ) : (
                <div className={styles.portraitFallback} aria-label={attorney.name}>
                  {initials}
                </div>
              )}
              <div className={styles.portraitFrame} aria-hidden="true" />
            </div>

            <div className={styles.heroCopy}>
              <p className={styles.brandMark}>{firmName}</p>
              <h1 id="attorney-name" className={styles.name}>
                {attorney.name}
              </h1>
              <p className={styles.title}>{attorney.title}</p>
              <p className={styles.lede}>{attorney.description}</p>

              <div className={styles.metaRow}>
                {primaryPractice ? (
                  <span className={styles.metaPill}>
                    <Briefcase size={14} aria-hidden="true" />
                    {primaryPractice}
                  </span>
                ) : null}
                {office ? (
                  <span className={styles.metaPill}>
                    <MapPin size={14} aria-hidden="true" />
                    {office}
                  </span>
                ) : null}
              </div>

              {attorney.practices.length > 1 ? (
                <div className={styles.practiceStrip}>
                  {attorney.practices.map((p) => (
                    <span key={p} className={styles.practiceChip}>
                      {p}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className={styles.body}>
        <main className={styles.main}>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <Scale size={18} aria-hidden="true" />
              <h2>Biography</h2>
            </div>
            <p className={styles.prose}>{attorney.bio}</p>
          </section>

          {matters.length > 0 ? (
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <Sparkles size={18} aria-hidden="true" />
                <h2>Selected experience</h2>
              </div>
              <ol className={styles.matterList}>
                {matters.map((matter, i) => (
                  <li key={i} className={styles.matterItem} style={{ animationDelay: `${i * 70}ms` }}>
                    <span className={styles.matterIndex}>{String(i + 1).padStart(2, '0')}</span>
                    <p>{matter}</p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </main>

        <aside className={styles.aside}>
          {attorney.credentials &&
          (attorney.credentials.education?.length || attorney.credentials.barAdmissions?.length) ? (
            <section className={styles.asideBlock}>
              <div className={styles.sectionHead}>
                <GraduationCap size={16} aria-hidden="true" />
                <h2>Credentials</h2>
              </div>
              {attorney.credentials.education?.length ? (
                <>
                  <h3 className={styles.subhead}>Education</h3>
                  <ul className={styles.metaList}>
                    {attorney.credentials.education.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {attorney.credentials.barAdmissions?.length ? (
                <>
                  <h3 className={styles.subhead}>Bar admissions</h3>
                  <ul className={styles.metaList}>
                    {attorney.credentials.barAdmissions.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          ) : null}

          {attorney.honors?.length ? (
            <section className={styles.asideBlock}>
              <h2>Honors</h2>
              <ul className={styles.metaList}>
                {attorney.honors.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {attorney.memberships?.length ? (
            <section className={styles.asideBlock}>
              <h2>Memberships</h2>
              <ul className={styles.metaList}>
                {attorney.memberships.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {attorney.thoughtLeadership?.length ? (
            <section className={styles.asideBlock}>
              <h2>Thought leadership</h2>
              <ul className={styles.metaList}>
                {attorney.thoughtLeadership.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {attorney.locations.length ? (
            <section className={styles.asideBlock}>
              <h2>Office</h2>
              <ul className={styles.metaList}>
                {attorney.locations.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

      <footer className={styles.footer}>
        <p className={styles.disclaimer}>
          Demo profile for {firmName} — fictional content for product demonstrations only. Not
          affiliated with any real law firm or attorney.
        </p>
      </footer>
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = listDemoAttorneys().map((a) => ({ params: { slug: a.slug } }));
  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps<Props> = async (ctx) => {
  const slug = String(ctx.params?.slug || '');
  const attorney = getDemoAttorneyBySlug(slug);
  if (!attorney) {
    return { notFound: true };
  }
  return {
    props: {
      attorney,
      firmName: FIRM_NAME,
    },
  };
};
