import fs from 'fs';
import path from 'path';
import type { ChatContentItem } from './types';
import { BIO_DETAIL } from './templates';

export interface DemoFirmMeta {
  name: string;
  shortName: string;
  website: string;
  productName: string;
  tagline?: string;
}

export interface DemoDataset {
  firm: DemoFirmMeta;
  items: ChatContentItem[];
}

export interface DemoAttorneyProfile {
  id: string;
  name: string;
  slug: string;
  url: string;
  title: string;
  bio: string;
  description: string;
  photoUrl?: string;
  gender?: 'male' | 'female';
  practices: string[];
  locations: string[];
  experience?: string;
  credentials?: {
    education: string[];
    barAdmissions: string[];
  };
  honors?: string[];
  memberships?: string[];
  thoughtLeadership?: string[];
}

/** Prefer stored photo; fall back to a local placeholder headshot keyed by gender. */
export function resolveDemoPhotoUrl(
  id: string,
  photoUrl?: string,
  gender?: 'male' | 'female'
): string | undefined {
  if (photoUrl?.trim()) {
    return photoUrl.trim();
  }
  if (id.startsWith('DEMOATTY')) {
    return gender === 'female' ? '/female-attorney.png' : '/male-attorney.png';
  }
  return undefined;
}

let cached: DemoDataset | null = null;

function datasetPath(): string {
  return path.join(process.cwd(), 'demo-data', 'attorneys.json');
}

export function loadDemoDataset(): DemoDataset {
  if (cached) return cached;
  const raw = fs.readFileSync(datasetPath(), 'utf8');
  cached = JSON.parse(raw) as DemoDataset;
  return cached;
}

function slugFromUrl(url: string): string {
  const parts = url.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

function parseTitle(extra: string): string {
  const match = /Position:\s*([^|]+)/i.exec(extra || '');
  return match?.[1]?.trim() || 'Attorney';
}

export function listDemoAttorneys(): DemoAttorneyProfile[] {
  const { items } = loadDemoDataset();
  return items
    .filter((item) => item.templateId === BIO_DETAIL || item.templateName === 'Bio Detail')
    .map((item) => ({
      id: item.id,
      name: item.title,
      slug: slugFromUrl(item.url),
      url: item.url,
      title: parseTitle(item.extra),
      bio: item.content,
      description: item.description,
      photoUrl: resolveDemoPhotoUrl(item.id, item.photoUrl, item.gender),
      gender: item.gender,
      practices: item.relatedPractices || [],
      locations: item.relatedLocations || [],
      experience: item.experience || '',
      credentials: item.credentials || { education: [], barAdmissions: [] },
      honors: item.honors || [],
      memberships: item.memberships || [],
      thoughtLeadership: item.thoughtLeadership || [],
    }));
}

export function getDemoAttorneyBySlug(slug: string): DemoAttorneyProfile | null {
  const normalized = slug.toLowerCase().replace(/^\/+|\/+$/g, '');
  return listDemoAttorneys().find((a) => a.slug === normalized) || null;
}
