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

const FIRM_NAME = process.env.NEXT_PUBLIC_FIRM_NAME || 'Altudo';

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
        <a href="/attorney-search" className={styles.headerLogo} aria-label="Altudo home">
          <svg className={styles.headerLogoImg} viewBox="0 0 400 101" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
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
          Demo profile for {firmName} &mdash; fictional content for product demonstrations only. Not
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
