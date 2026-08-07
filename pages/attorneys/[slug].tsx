import React from 'react';
import Head from 'next/head';
import type { GetStaticPaths, GetStaticProps } from 'next';
import { ArrowLeft, Briefcase, MapPin } from 'lucide-react';
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

export default function AttorneyBioPage({ attorney, firmName }: Props) {
  const initials = attorney.name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={styles.page}>
      <Head>
        <title>
          {attorney.name} | {attorney.title} | {firmName}
        </title>
        <meta name="description" content={attorney.description} />
      </Head>

      <header className={styles.header}>
        <a href="/attorney-search" className={styles.headerLogo} aria-label={`${firmName} home`}>
          {firmName}
        </a>
        <span className={styles.kicker}>Attorney Profile</span>
      </header>

      <div className={styles.wrap}>
        <a className={styles.back} href="/attorney-search">
          <ArrowLeft size={16} aria-hidden="true" /> Back to attorney search
        </a>

        <div className={styles.heroCard}>
          <div className={styles.avatar} aria-hidden="true">
            {initials}
          </div>
          <div>
            <h1 className={styles.name}>{attorney.name}</h1>
            <p className={styles.title}>{attorney.title}</p>
            <div className={styles.tags}>
              {attorney.practices.map((p) => (
                <span className={styles.tag} key={p}>
                  <Briefcase size={12} aria-hidden="true" /> {p}
                </span>
              ))}
              {attorney.locations.map((l) => (
                <span className={styles.tag} key={l}>
                  <MapPin size={12} aria-hidden="true" /> {l}
                </span>
              ))}
            </div>
          </div>
        </div>

        <section className={styles.section}>
          <h2>Biography</h2>
          <p>{attorney.bio}</p>
        </section>

        {attorney.experience ? (
          <section className={styles.section}>
            <h2>Experience</h2>
            <p>{attorney.experience}</p>
          </section>
        ) : null}

        {attorney.credentials ? (
          <section className={styles.section}>
            <h2>Credentials</h2>
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
                <h3 className={styles.subhead}>Bar Admissions</h3>
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
          <section className={styles.section}>
            <h2>Honors</h2>
            <ul className={styles.metaList}>
              {attorney.honors.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {attorney.memberships?.length ? (
          <section className={styles.section}>
            <h2>Memberships</h2>
            <ul className={styles.metaList}>
              {attorney.memberships.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {attorney.thoughtLeadership?.length ? (
          <section className={styles.section}>
            <h2>Thought Leadership</h2>
            <ul className={styles.metaList}>
              {attorney.thoughtLeadership.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={styles.section}>
          <h2>Practice focus</h2>
          <ul className={styles.metaList}>
            {attorney.practices.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>

        <section className={styles.section}>
          <h2>Office</h2>
          <ul className={styles.metaList}>
            {attorney.locations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>

        <p className={styles.disclaimer}>
          Demo profile for {firmName} — fictional content for product demonstrations only. Not
          affiliated with any real law firm or attorney.
        </p>
      </div>
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
