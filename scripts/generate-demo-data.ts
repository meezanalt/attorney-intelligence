/**
 * Regenerates demo-data/attorneys.json with production-quality fictional bios.
 *
 * Usage: npx ts-node -P scripts/tsconfig.json scripts/generate-demo-data.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const OUT = path.join(__dirname, '..', 'demo-data', 'attorneys.json');
const BIO_TID = 'F594ABEFF4174151BE316B7E159601AE';
const PRAC_TID = '0D94B84662CC430B958A1DAF02D1A9BA';
const LOC_TID = '7436F28126D54E939B173FA996A317EC';

type Credentials = { education: string[]; barAdmissions: string[] };

interface BioItem {
  id: string;
  templateId: string;
  templateName: string;
  title: string;
  url: string;
  content: string;
  description: string;
  extra: string;
  language: string;
  relatedPractices: string[];
  relatedLocations: string[];
  experience: string;
  credentials: Credentials;
  honors: string[];
  memberships: string[];
  thoughtLeadership: string[];
}

interface ContentItem {
  id: string;
  templateId: string;
  templateName: string;
  title: string;
  url: string;
  content: string;
  description: string;
  extra: string;
  language: string;
  relatedPractices: string[];
  relatedLocations: string[];
  experience?: string;
  credentials?: Credentials;
  honors?: string[];
  memberships?: string[];
  thoughtLeadership?: string[];
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function padId(n: number, width = 30): string {
  return String(n).padStart(width, '0');
}

const LAW_SCHOOLS = [
  'Northbridge University School of Law',
  'Cascadia College of Law',
  'Meridian Law School',
  'Harborview University School of Law',
  'Stonegate School of Law',
  'Riverton University College of Law',
  'Westmoor Law School',
  'Ashford University School of Law',
  'Lakewood College of Law',
  'Summit Ridge School of Law',
  'Fairmont University School of Law',
  'Crestview Law School',
];

const UNDERGRADS = [
  'B.A., Northbridge University',
  'B.S., Cascadia College',
  'B.A., Meridian College',
  'B.S., Harborview University',
  'B.A., Stonegate College',
  'B.S., Riverton University',
  'B.A., Westmoor College',
  'B.S., Ashford University',
  'B.A., Lakewood College',
  'B.S., Summit Ridge University',
  'B.A., Fairmont University',
  'B.S., Crestview College',
];

const BAR_BY_CITY: Record<string, string[]> = {
  Boston: ['Massachusetts', 'New York'],
  Chicago: ['Illinois', 'Wisconsin'],
  Denver: ['Colorado', 'Wyoming'],
  Seattle: ['Washington', 'Oregon'],
  Austin: ['Texas', 'Colorado'],
};

const MEMBERSHIP_POOL: Record<string, string[]> = {
  Corporate: [
    'American Bar Association, Business Law Section',
    'Association for Corporate Growth',
    'National Association of Corporate Directors (affiliate)',
  ],
  'Mergers and Acquisitions': [
    'American Bar Association, Mergers & Acquisitions Committee',
    'Association for Corporate Growth',
    'Private Equity Women Investor Network (affiliate counsel)',
  ],
  Litigation: [
    'American Bar Association, Litigation Section',
    'Federal Bar Association',
    'Defense Research Institute',
  ],
  'Real Estate': [
    'American College of Real Estate Lawyers (nominee network)',
    'Urban Land Institute',
    'American Bar Association, Real Property Section',
  ],
  'Labor and Employment': [
    'American Bar Association, Labor and Employment Law Section',
    'College of Labor and Employment Lawyers (affiliate)',
    'Society for Human Resource Management (legal counsel network)',
  ],
  'Intellectual Property': [
    'American Intellectual Property Law Association',
    'International Trademark Association',
    'Intellectual Property Owners Association',
  ],
  Immigration: [
    'American Immigration Lawyers Association',
    'American Bar Association, Immigration and Naturalization Committee',
    'Federal Bar Association, Immigration Law Section',
  ],
  Healthcare: [
    'American Health Law Association',
    'American Bar Association, Health Law Section',
    'Healthcare Financial Management Association (legal affiliate)',
  ],
  default: [
    'American Bar Association',
    'Local county bar association',
    'Federal Bar Association',
  ],
};

type FocusKey =
  | 'corporate_ma'
  | 'litigation'
  | 'real_estate'
  | 'labor'
  | 'ip'
  | 'immigration'
  | 'healthcare'
  | 'tax'
  | 'antitrust';

function primaryFocus(practices: string[]): FocusKey {
  const p = practices.map((x) => x.toLowerCase());
  if (p.some((x) => x.includes('immigration'))) return 'immigration';
  if (p.some((x) => x.includes('healthcare') || x.includes('health care'))) return 'healthcare';
  if (p.some((x) => x.includes('intellectual') || x.includes('patent') || x.includes('trademark') || x.includes('copyright') || x.includes('privacy') || x.includes('itc')))
    return 'ip';
  if (p.some((x) => x.includes('labor') || x.includes('employment') || x.includes('executive compensation')))
    return 'labor';
  if (p.some((x) => x.includes('real estate') || x.includes('land use') || x.includes('leasing')))
    return 'real_estate';
  if (p.some((x) => x === 'tax' || x.includes('tax'))) return 'tax';
  if (p.some((x) => x.includes('antitrust'))) return 'antitrust';
  if (
    p.some(
      (x) =>
        x.includes('litigation') ||
        x.includes('appellate') ||
        x.includes('class action') ||
        x.includes('white collar') ||
        x.includes('securities litigation') ||
        x.includes('trade secret')
    )
  )
    return 'litigation';
  return 'corporate_ma';
}

function membershipKey(practices: string[]): string {
  const focus = primaryFocus(practices);
  const map: Record<FocusKey, string> = {
    corporate_ma: practices.some((p) => /mergers/i.test(p)) ? 'Mergers and Acquisitions' : 'Corporate',
    litigation: 'Litigation',
    real_estate: 'Real Estate',
    labor: 'Labor and Employment',
    ip: 'Intellectual Property',
    immigration: 'Immigration',
    healthcare: 'Healthcare',
    tax: 'Corporate',
    antitrust: 'Litigation',
  };
  return map[focus];
}

function firstName(full: string): string {
  return full.split(/\s+/)[0];
}

function pronouns(_name: string, i: number): { they: string; their: string; them: string } {
  // Alternate for variety while staying gender-neutral / third-person professional
  const styles = [
    { they: 'They', their: 'their', them: 'them' },
    { they: 'He', their: 'his', them: 'him' },
    { they: 'She', their: 'her', them: 'her' },
  ];
  return styles[i % 3];
}

function titleCasePosition(extra: string): string {
  const m = /Position:\s*([^|]+)/i.exec(extra || '');
  return (m?.[1] || 'Attorney').trim();
}

function practicePhrase(practices: string[]): string {
  if (practices.length === 0) return 'general practice';
  if (practices.length === 1) return practices[0];
  return `${practices[0]} and ${practices[1]}`;
}

function buildContent(
  name: string,
  position: string,
  practices: string[],
  city: string,
  focus: FocusKey,
  i: number
): { content: string; description: string } {
  const first = firstName(name);
  const pr = pronouns(name, i);
  const practice = practicePhrase(practices);

  const focuses: Record<FocusKey, string[]> = {
    corporate_ma: [
      'mergers, acquisitions, and strategic joint ventures',
      'private equity-backed acquisitions, carve-outs, and add-on investments',
      'venture financings, governance, and growth-stage exits',
      'public offerings, private placements, and securities compliance',
      'cross-border M&A and post-closing integration planning',
    ],
    litigation: [
      'complex commercial disputes and business torts',
      'class action defense and multidistrict litigation',
      'securities litigation and shareholder disputes',
      'white collar defense and government investigations',
      'appellate advocacy and complex motions practice',
      'trade secret misappropriation and unfair competition claims',
    ],
    real_estate: [
      'acquisitions, dispositions, and mixed-use development',
      'construction and permanent financing, and loan workouts',
      'commercial leasing for landlords and national tenants',
      'land use, entitlements, and zoning strategy',
      'real estate litigation and construction disputes',
    ],
    labor: [
      'employment counseling, investigations, and workforce compliance',
      'restrictive covenants, trade secrets, and executive transitions',
      'traditional labor relations and collective bargaining support',
      'employment litigation and agency proceedings',
    ],
    ip: [
      'patent litigation and competitor disputes',
      'patent strategy and prosecution for technology and life sciences',
      'trademark, copyright, and brand enforcement',
      'privacy, cybersecurity, and data arrangements',
      'ITC investigations and parallel district court actions',
    ],
    immigration: [
      'business immigration, work visas, and permanent residence strategy',
      'employer compliance, I-9 audits, and worksite enforcement response',
      'investor and executive mobility programs for multinational clients',
      'contested immigration proceedings and federal court review',
    ],
    healthcare: [
      'healthcare regulatory counseling and enforcement defense',
      'provider transactions, joint ventures, and affiliation agreements',
      'False Claims Act and reimbursement disputes',
      'telehealth, digital health, and privacy compliance for providers',
    ],
    tax: [
      'transactional tax planning for corporate and private equity deals',
      'partnership tax and carried interest structuring',
      'cross-border tax-efficient acquisitions and reorganizations',
    ],
    antitrust: [
      'antitrust counseling for mergers and competitor collaborations',
      'competition disputes and government investigation response',
      'distribution, pricing, and trade association counseling',
    ],
  };

  const focusLine = pick(focuses[focus], i);
  const clientLines = [
    'Clients include mid-market and public companies, private equity sponsors, and growth-stage businesses.',
    'Clients range from founder-led companies to institutional investors and multinational operating businesses.',
    'Clients include strategic buyers, portfolio companies, and closely held businesses navigating complex transactions and disputes.',
    'Clients span regulated industries, technology businesses, and institutional investors with multijurisdictional needs.',
  ];

  const styleLines = [
    `${first} is known for practical advice, clear communication, and aligning legal strategy with business goals.`,
    `${pr.they} combine${pr.they === 'They' ? '' : 's'} rigorous analysis with pragmatic deal and case management.`,
    `Colleagues and clients value ${pr.their} calm judgment under pressure and disciplined project management.`,
    `${first} brings a business-minded approach and a reputation for responsive, candid counseling.`,
  ];

  const content = [
    `${name} is ${position === 'Associate' || position === 'Of Counsel' ? 'an' : 'a'} ${position} in the ${practices[0] || 'Corporate'} practice of Harrow & Vance LLP, based in ${city}.`,
    `${pr.their === 'their' ? 'Their' : pr.their === 'his' ? 'His' : 'Her'} practice focuses on ${focusLine} for companies and investors across multiple industries.`,
    pick(styleLines, i),
    pick(clientLines, i + 1),
  ].join(' ');

  const description = `${practices[0] || 'Corporate'} ${position.toLowerCase()} focused on ${focusLine}.`;
  return { content, description };
}

function buildExperience(name: string, focus: FocusKey, city: string, practices: string[], i: number): string {
  const first = firstName(name);
  const templates: Record<FocusKey, string[][]> = {
    corporate_ma: [
      [
        `${first} recently led sell-side counsel on an approximately $420 million sale of a specialty chemicals manufacturer to a strategic buyer, coordinating antitrust filings and a complex earn-out structure.`,
        `${first} has advised private equity sponsors on platform acquisitions and add-ons in industrial services, typically ranging from $75 million to $250 million in enterprise value.`,
        `In a cross-border joint venture for a logistics technology company, ${first} negotiated governance, exit rights, and IP contribution terms across three jurisdictions.`,
        `${first} regularly counsels boards on fiduciary considerations in competitive auction processes and distressed sales.`,
      ],
      [
        `${first} represented a growth-equity fund in a $185 million Series D and related secondary tender for a SaaS analytics company headquartered near ${city}.`,
        `${first} has closed more than a dozen carve-out acquisitions involving shared-services TSAs, employee transfers, and transitional IP licenses.`,
        `On a contested public-company merger, ${first} advised the special committee through diligence, fairness-opinion coordination, and stockholder litigation preparedness.`,
        `${first}'s matters frequently involve manufacturing, healthcare services, and business-services portfolio companies.`,
      ],
      [
        `${first} guided a founder-led software company through a dual-track IPO readiness and strategic sale process that concluded in a $610 million acquisition.`,
        `${first} has structured minority investments with board observer rights, protective provisions, and drag/tag mechanics for family offices and strategic corporates.`,
        `In a $95 million management buyout of a regional distribution business, ${first} coordinated financing counsel, rollover equity, and post-closing working-capital mechanics.`,
        `${first} also advises on stockholder agreements, equity incentive plans, and governance clean-ups ahead of institutional raises.`,
      ],
    ],
    litigation: [
      [
        `${first} obtained summary judgment for a mid-market manufacturer in a $48 million trade-secret and breach-of-contract dispute arising from a failed channel partnership.`,
        `${first} has defended consumer and B2B class actions alleging false advertising and warranty claims across multiple federal districts.`,
        `In a bet-the-company partnership dispute, ${first} coordinated emergency injunctive briefing and a negotiated buyout that avoided a two-week trial.`,
        `${first} regularly handles complex discovery programs involving ESI protocols, privilege logs, and expert-heavy damages theories.`,
      ],
      [
        `${first} represented an audit-committee special counsel mandate in a securities investigation involving revenue-recognition issues at a publicly traded healthcare company.`,
        `${first} has briefed and argued appeals in the First, Seventh, and Tenth Circuits on contract interpretation and class-certification issues.`,
        `On a multidistrict product-liability matter, ${first} managed coordinated discovery for a regional defendant group with exposure exceeding $200 million in claimed damages.`,
        `${first} also advises boards on litigation strategy, settlement authority, and insurance recovery.`,
      ],
      [
        `${first} defended a private equity-backed portfolio company in a $110 million earn-out and indemnification arbitration seated in ${city}.`,
        `${first} has led internal investigations involving sales-practices allegations, document holds, and government subpoena response.`,
        `In a competitor trade-secret case, ${first} secured a preliminary injunction and a stipulated forensic protocol within six weeks of filing.`,
        `${first}'s docket spans commercial contracts, fiduciary duty claims, and post-closing M&A disputes.`,
      ],
    ],
    real_estate: [
      [
        `${first} led acquisition counsel on a $275 million mixed-use portfolio spanning office, retail, and multifamily assets in three metros.`,
        `${first} has negotiated construction loans and permanent take-outs for ground-up industrial and life-science projects totaling more than $500 million in commitments.`,
        `In a ground-lease renegotiation for a downtown tower, ${first} restructured rent reset mechanics and assignment controls for a REIT landlord.`,
        `${first} regularly coordinates environmental diligence, title curative work, and joint-venture waterfall negotiations.`,
      ],
      [
        `${first} represented a national tenant in a 420,000-square-foot headquarters lease with complex expansion, contraction, and early-termination options.`,
        `${first} has closed sale-leaseback financings for logistics and manufacturing clients in the $40–$120 million range.`,
        `On a distressed hotel workout, ${first} negotiated forbearance, receiver transition, and a consensual deed-in-lieu that preserved franchise value.`,
        `${first} also advises on condominium conversions, air-rights transfers, and construction dispute mediation.`,
      ],
    ],
    labor: [
      [
        `${first} advised a 4,200-employee healthcare system on a reduction-in-force, WARN Act compliance, and related age-discrimination risk mitigation.`,
        `${first} has litigated and settled noncompete and trade-secret actions involving departing sales executives in technology and life-sciences companies.`,
        `In a NLRB unfair-labor-practice investigation, ${first} coordinated response strategy and trained managers on lawful communications during organizing.`,
        `${first} regularly drafts executive employment agreements, severance, and change-in-control arrangements for portfolio-company leadership teams.`,
      ],
      [
        `${first} conducted a privileged workplace investigation into harassment and retaliation allegations at a manufacturing client with facilities in four states.`,
        `${first} has defended wage-and-hour collective actions alleging misclassification of field technicians, achieving class-narrowing rulings and a structured settlement.`,
        `On a cross-border executive hire, ${first} negotiated restrictive covenants calibrated to enforceability risk in ${city} and neighboring jurisdictions.`,
        `${first} also counsels on handbook updates, pay-transparency compliance, and AI-assisted hiring policy design.`,
      ],
    ],
    ip: [
      [
        `${first} tried a patent infringement case involving industrial sensor technology to a jury verdict of noninfringement after a two-week trial.`,
        `${first} has managed global patent prosecution portfolios for medical-device and semiconductor clients, aligning claim strategy with product roadmaps.`,
        `In a trademark enforcement campaign, ${first} secured ex parte seizures and a consent judgment against counterfeit distributors operating online marketplaces.`,
        `${first} regularly advises on freedom-to-operate opinions, IP due diligence in M&A, and open-source compliance.`,
      ],
      [
        `${first} represented a cloud-software company in parallel ITC and district-court proceedings involving networking patents, culminating in a global license.`,
        `${first} has negotiated complex data-processing and cybersecurity addenda for enterprise SaaS deals with regulated customers.`,
        `On a trade-dress and copyright dispute in the consumer-products space, ${first} obtained a preliminary injunction and a brand coexistence agreement.`,
        `${first} also counsels boards on IP risk in generative-AI product launches.`,
      ],
    ],
    immigration: [
      [
        `${first} secured O-1 and EB-1 approvals for a cohort of research scientists joining a ${city}-area biotech scale-up after a Series C financing.`,
        `${first} has designed employer immigration compliance programs covering I-9 audits, E-Verify workflows, and worksite-enforcement preparedness for multi-state employers.`,
        `In a PERM and I-140 strategy for a multinational engineering firm, ${first} aligned filing timelines with a $90 million facility expansion and related hiring plan.`,
        `${first} regularly advises HR and board leadership on executive transfers, L-1 blanket petitions, and dual-intent planning.`,
      ],
      [
        `${first} obtained H-1B, TN, and L-1A approvals supporting a 180-person product organization through a post-acquisition integration.`,
        `${first} has represented employers in ICE Notice of Inspection responses and negotiated corrective action plans that avoided criminal referral.`,
        `On investor-based matters, ${first} structured E-2 and EB-5 pathways for founders relocating operating companies into the United States.`,
        `${first} also handles consular processing crises, RFE strategy, and federal litigation challenging unlawful denials.`,
      ],
    ],
    healthcare: [
      [
        `${first} advised a regional hospital system on a $160 million ambulatory joint venture, including Stark, Anti-Kickback, and state facility-licensing analysis.`,
        `${first} has defended providers in False Claims Act investigations involving coding and medical-necessity allegations with potential exposure above $75 million.`,
        `In a telehealth platform launch, ${first} negotiated physician contracts, multi-state licensing pathways, and privacy/security program buildouts.`,
        `${first} regularly counsels boards on quality reporting, credentialing disputes, and payer-contract renegotiations.`,
      ],
      [
        `${first} led regulatory diligence for a private equity acquisition of a specialty pharmacy network across eight states.`,
        `${first} has negotiated clinically integrated network and CIN/ACO participation agreements for independent physician groups.`,
        `On a CMS survey and civil-money-penalty matter, ${first} coordinated corrective-action plans and informal dispute resolution that reduced penalties by more than half.`,
        `${first} also advises digital-health companies on HIPAA, FTC health-privacy expectations, and FDA device-software classification issues.`,
      ],
    ],
    tax: [
      [
        `${first} structured tax-free reorganization treatment for a $380 million strategic combination of two closely held manufacturing groups.`,
        `${first} has advised private equity funds on partnership allocations, 1060 purchase-price allocations, and management rollover tax planning.`,
        `In a cross-border acquisition, ${first} designed holding-company and IP-migration steps that reduced expected effective tax rate while addressing anti-hybrid rules.`,
        `${first} regularly coordinates with corporate counsel on earn-outs, contingent consideration, and installment-sale elections.`,
      ],
    ],
    antitrust: [
      [
        `${first} guided HSR strategy and second-request preparedness for a $1.1 billion horizontal combination in specialty distribution.`,
        `${first} has defended companies in competitor and customer challenges alleging exclusive dealing and loyalty-rebate programs.`,
        `On a trade-association counseling matter, ${first} redesigned information-sharing protocols to reduce cartel-risk exposure.`,
        `${first} also advises on gun-jumping compliance and clean-team protocols during competitive auctions.`,
      ],
    ],
  };

  const set = pick(templates[focus], i);
  return set.join(' ');
}

function buildCredentials(city: string, i: number, practices: string[]): Credentials {
  const law = pick(LAW_SCHOOLS, i);
  const undergrad = pick(UNDERGRADS, i + 3);
  const bars = BAR_BY_CITY[city] || ['New York'];
  const admissions = [bars[0]];
  if (i % 2 === 0 && bars[1]) admissions.push(bars[1]);
  if (i % 5 === 0) admissions.push('District of Columbia');
  // USPTO for IP patent folks
  if (practices.some((p) => /patent/i.test(p)) && i % 2 === 0) {
    admissions.push('United States Patent and Trademark Office');
  }
  return {
    education: [`J.D., ${law}`, undergrad],
    barAdmissions: admissions,
  };
}

function buildHonors(practices: string[], focus: FocusKey, i: number): string[] {
  const area =
    practices[0] ||
    ({
      corporate_ma: 'Corporate/M&A',
      litigation: 'Commercial Litigation',
      real_estate: 'Real Estate Law',
      labor: 'Labor and Employment Law',
      ip: 'Intellectual Property',
      immigration: 'Immigration Law',
      healthcare: 'Healthcare Law',
      tax: 'Tax Law',
      antitrust: 'Antitrust Law',
    }[focus] as string);

  const yearStart = 2019 + (i % 5);
  const yearEnd = yearStart + 2 + (i % 3);
  const range = `${yearStart}–${yearEnd}`;

  const pool = [
    `Recognized in Chambers USA for ${area}, ${range}`,
    `Listed in Best Lawyers in America, ${area}, ${range}`,
    `Named a Super Lawyers Rising Star, ${area}, ${yearStart}–${yearStart + 2}`,
    `Listed in Legal 500 United States for ${area}, ${range}`,
    `Selected to Benchmark Litigation Stars, ${area}, ${yearEnd}`,
    `Recognized by Lawdragon 500 Leading Lawyers in ${area}, ${yearEnd}`,
  ];

  const count = 2 + (i % 2);
  const out: string[] = [];
  for (let k = 0; k < count; k++) out.push(pick(pool, i + k * 2));
  return [...new Set(out)].slice(0, 3);
}

function buildMemberships(practices: string[], city: string, i: number): string[] {
  const key = membershipKey(practices);
  const pool = MEMBERSHIP_POOL[key] || MEMBERSHIP_POOL.default;
  const local = `${city} Bar Association`;
  const out = [pick(pool, i), local];
  if (i % 3 === 0) out.push(pick(pool, i + 1));
  return [...new Set(out)].slice(0, 3);
}

function buildThoughtLeadership(name: string, focus: FocusKey, practices: string[], i: number): string[] {
  const first = firstName(name);
  const area = practices[0] || 'Business Law';
  const pubs: Record<FocusKey, string[][]> = {
    corporate_ma: [
      [
        `Co-author, "Earn-Out Drafting After a Volatile Market," Harrow & Vance Corporate Alert (${2022 + (i % 3)})`,
        `Panelist, Association for Corporate Growth "${cityPanel(i)} Dealmakers Forum" on middle-market M&A`,
        `Speaker, "Board Fiduciary Duties in Dual-Track Processes," firm client webinar series`,
      ],
    ],
    litigation: [
      [
        `Author, "Managing Trade Secret Injunctions in the Remote-Work Era," Commercial Litigation Review (${2021 + (i % 4)})`,
        `Faculty, "ESI Protocols That Actually Work," federal practice CLE`,
        `Quoted speaker, "Class Certification Trends in Consumer Cases," regional litigation summit`,
      ],
    ],
    real_estate: [
      [
        `Co-author, "Construction Loan Workouts: A Landlord-Lender Playbook," Real Estate Finance Journal (${2022 + (i % 3)})`,
        `Panelist, Urban Land Institute program on mixed-use entitlements`,
        `Presenter, "Lease Restructuring After Office Utilization Shifts," firm real estate series`,
      ],
    ],
    labor: [
      [
        `Author, "Noncompete Reform and Trade Secret Alternatives," Employment Law Briefing (${2023 + (i % 2)})`,
        `Speaker, "Conducting Credible Workplace Investigations," in-house counsel roundtable`,
        `Co-presenter, "Pay Transparency Compliance Across Multi-State Employers," HR legal forum`,
      ],
    ],
    ip: [
      [
        `Author, "FTO Opinions in AI-Enabled Products," IP Strategy Quarterly (${2022 + (i % 3)})`,
        `Panelist, AIPLA webinar on ITC discovery coordination`,
        `Speaker, "Brand Enforcement on Online Marketplaces," trademark counsel forum`,
      ],
    ],
    immigration: [
      [
        `Author, "Building Scalable Immigration Compliance After Rapid Hiring," AILA Practice Notes (${2023 + (i % 2)})`,
        `Speaker, "PERM Timing and Facility Expansions," employer mobility conference`,
        `Panelist, "Executive Transfers in Cross-Border M&A," business immigration symposium`,
      ],
    ],
    healthcare: [
      [
        `Co-author, "Ambulatory JV Structures Under Stark and AKS," Health Law Advisor (${2022 + (i % 3)})`,
        `Speaker, "Telehealth Contracting Across State Lines," AHLA webinar`,
        `Presenter, "FCA Risk in Coding and Documentation," provider compliance summit`,
      ],
    ],
    tax: [
      [
        `Author, "Purchase Price Allocation Pitfalls in PE Deals," Tax Transaction Brief (${2022 + (i % 3)})`,
        `Speaker, "Cross-Border Holding Structures for Mid-Market Buyers," firm tax series`,
      ],
    ],
    antitrust: [
      [
        `Author, "Clean Teams and Gun-Jumping Risk in Competitive Auctions," Antitrust Counselor (${2023 + (i % 2)})`,
        `Panelist, "Second Request Readiness for Middle-Market Combinations," competition law forum`,
      ],
    ],
  };

  void first;
  void area;
  const set = pick(pubs[focus], i);
  return set.slice(0, 1 + (i % 3));
}

function cityPanel(i: number): string {
  return pick(['Northeast', 'Midwest', 'Mountain West', 'Pacific Northwest', 'Southwest'], i);
}

function enrichBio(raw: ContentItem, index: number): BioItem {
  // Spread a subset into Austin so the fifth office has real directory coverage.
  let city = raw.relatedLocations[0] || 'Boston';
  let locations = [...(raw.relatedLocations || [])];
  if (index % 18 === 17) {
    city = 'Austin';
    locations = ['Austin'];
  }
  const practices = raw.relatedPractices || [];
  const focus = primaryFocus(practices);
  const position = titleCasePosition(raw.extra);
  const { content, description } = buildContent(raw.title, position, practices, city, focus, index);
  const experience = buildExperience(raw.title, focus, city, practices, index);
  const credentials = buildCredentials(city, index, practices);
  const honors = buildHonors(practices, focus, index);
  const memberships = buildMemberships(practices, city, index);
  const thoughtLeadership = buildThoughtLeadership(raw.title, focus, practices, index);

  return {
    id: raw.id,
    templateId: BIO_TID,
    templateName: 'Bio Detail',
    title: raw.title,
    url: raw.url,
    content,
    description,
    extra: raw.extra,
    language: 'en',
    relatedPractices: practices,
    relatedLocations: locations,
    experience,
    credentials,
    honors,
    memberships,
    thoughtLeadership,
  };
}

function makeImmigrationBios(startId: number): BioItem[] {
  const people: Array<{
    name: string;
    position: string;
    practices: string[];
    city: string;
  }> = [
    {
      name: 'Marisol Reyes',
      position: 'Partner',
      practices: ['Immigration'],
      city: 'Boston',
    },
    {
      name: 'Daniel Cho',
      position: 'Partner',
      practices: ['Immigration', 'Labor and Employment'],
      city: 'Chicago',
    },
    {
      name: 'Priya Sankar',
      position: 'Counsel',
      practices: ['Immigration'],
      city: 'Denver',
    },
    {
      name: 'Jonah Ellison',
      position: 'Associate',
      practices: ['Immigration', 'Litigation'],
      city: 'Seattle',
    },
    {
      name: 'Camila Duarte',
      position: 'Special Counsel',
      practices: ['Immigration'],
      city: 'Austin',
    },
  ];

  return people.map((p, idx) => {
    const idNum = startId + idx;
    const extra = `Position: ${p.position} | Practice areas: ${p.practices.join(', ')}`;
    const raw: ContentItem = {
      id: `DEMOATTY${padId(idNum)}`,
      templateId: BIO_TID,
      templateName: 'Bio Detail',
      title: p.name,
      url: `/attorneys/${slugify(p.name)}`,
      content: '',
      description: '',
      extra,
      language: 'en',
      relatedPractices: p.practices,
      relatedLocations: [p.city],
    };
    return enrichBio(raw, 200 + idx);
  });
}

function makeHealthcareBoost(startId: number): BioItem[] {
  // Dedicated healthcare (not only Litigation secondary) for better discovery demos
  const people = [
    {
      name: 'Evelyn Marks',
      position: 'Partner',
      practices: ['Healthcare'],
      city: 'Boston',
    },
    {
      name: 'Ravi Deshmukh',
      position: 'Counsel',
      practices: ['Healthcare', 'Corporate'],
      city: 'Chicago',
    },
    {
      name: 'Simone Adler',
      position: 'Associate',
      practices: ['Healthcare', 'Privacy and Cybersecurity'],
      city: 'Austin',
    },
  ];

  return people.map((p, idx) => {
    const idNum = startId + idx;
    const extra = `Position: ${p.position} | Practice areas: ${p.practices.join(', ')}`;
    const raw: ContentItem = {
      id: `DEMOATTY${padId(idNum)}`,
      templateId: BIO_TID,
      templateName: 'Bio Detail',
      title: p.name,
      url: `/attorneys/${slugify(p.name)}`,
      content: '',
      description: '',
      extra,
      language: 'en',
      relatedPractices: p.practices,
      relatedLocations: [p.city],
    };
    return enrichBio(raw, 300 + idx);
  });
}

function practicePage(id: number, title: string, slug: string, blurb: string, long: string): ContentItem {
  return {
    id: `DEMOPRAC${padId(id)}`,
    templateId: PRAC_TID,
    templateName: 'Practice',
    title,
    url: `/practices/${slug}`,
    content: `The ${title} practice at Harrow & Vance LLP ${long} Attorneys collaborate across Boston, Chicago, Denver, Seattle, and Austin.`,
    description: blurb,
    extra: '',
    language: 'en',
    relatedPractices: [title],
    relatedLocations: [],
  };
}

function locationPage(id: number, title: string, slug: string): ContentItem {
  return {
    id: `DEMOLOC${padId(id)}`,
    templateId: LOC_TID,
    templateName: 'Location',
    title,
    url: `/offices/${slug}`,
    content: `The ${title} office of Harrow & Vance LLP serves clients across the region with strengths spanning corporate, litigation, real estate, employment, intellectual property, immigration, and healthcare. Attorneys collaborate with colleagues in other offices on multijurisdictional matters.`,
    description: `Harrow & Vance ${title} office.`,
    extra: '',
    language: 'en',
    relatedPractices: [],
    relatedLocations: [title],
  };
}

function main(): void {
  const existing = JSON.parse(fs.readFileSync(OUT, 'utf8')) as {
    firm: Record<string, string>;
    items: ContentItem[];
  };

  // Idempotent: only re-enrich the original 100 demo bios (IDs 1–100), then append
  // Immigration / Healthcare expansions. Avoids duplicating on re-run.
  const bios = existing.items.filter((i) => {
    if (i.templateName !== 'Bio Detail') return false;
    const n = parseInt(i.id.replace(/\D/g, ''), 10);
    return !Number.isNaN(n) && n <= 100;
  });
  const enrichedBios = bios.map((b, i) => enrichBio(b, i));

  const immigration = makeImmigrationBios(101);
  const healthcare = makeHealthcareBoost(101 + immigration.length);
  const allBios = [...enrichedBios, ...immigration, ...healthcare];

  // Refresh practice/location pages; add Immigration, Healthcare, Austin
  const practices: ContentItem[] = [
    practicePage(1, 'Corporate', 'corporate', 'Full-service corporate counseling for transactions, financings, and governance.', 'provides full-service corporate counseling for transactions, financings, and governance.'),
    practicePage(2, 'Mergers and Acquisitions', 'mergers-and-acquisitions', 'Buy-side and sell-side M&A for strategic and private equity clients.', 'handles buy-side and sell-side M&A for strategic and private equity clients.'),
    practicePage(3, 'Litigation', 'litigation', 'Business litigation, class actions, white collar defense, and appeals.', 'handles business litigation, class actions, white collar defense, and appeals.'),
    practicePage(4, 'Real Estate', 'real-estate', 'Real estate transactions, finance, leasing, land use, and disputes.', 'covers real estate transactions, finance, leasing, land use, and disputes.'),
    practicePage(5, 'Labor and Employment', 'labor-and-employment', 'Employment counseling, traditional labor, and employment litigation.', 'advises on employment counseling, traditional labor, and employment litigation.'),
    practicePage(6, 'Intellectual Property', 'intellectual-property', 'Patents, trademarks, copyrights, trade secrets, and privacy counseling.', 'covers patents, trademarks, copyrights, trade secrets, and privacy counseling.'),
    practicePage(7, 'Immigration', 'immigration', 'Business immigration, compliance, and mobility for employers and executives.', 'advises employers and executives on business immigration, compliance, and global mobility.'),
    practicePage(8, 'Healthcare', 'healthcare', 'Healthcare regulatory counseling, provider transactions, and enforcement defense.', 'advises on healthcare regulatory counseling, provider transactions, and enforcement defense.'),
  ];

  const locations: ContentItem[] = [
    locationPage(1, 'Boston', 'boston'),
    locationPage(2, 'Chicago', 'chicago'),
    locationPage(3, 'Denver', 'denver'),
    locationPage(4, 'Seattle', 'seattle'),
    locationPage(5, 'Austin', 'austin'),
  ];

  const dataset = {
    firm: {
      ...existing.firm,
      tagline:
        existing.firm.tagline ||
        'A fictional full-service law firm for product demonstrations only.',
    },
    items: [...allBios, ...practices, ...locations],
  };

  fs.writeFileSync(OUT, JSON.stringify(dataset, null, 2) + '\n', 'utf8');

  const focusCounts: Record<string, number> = {};
  for (const b of allBios) {
    const f = primaryFocus(b.relatedPractices);
    focusCounts[f] = (focusCounts[f] || 0) + 1;
  }

  console.log(`[generate-demo-data] Wrote ${allBios.length} bios + ${practices.length} practices + ${locations.length} locations`);
  console.log('[generate-demo-data] Focus distribution:', focusCounts);
  console.log(`[generate-demo-data] Output: ${OUT}`);
}

main();
