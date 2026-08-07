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
  practices: string[];
  locations: string[];
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
      practices: item.relatedPractices || [],
      locations: item.relatedLocations || [],
    }));
}

export function getDemoAttorneyBySlug(slug: string): DemoAttorneyProfile | null {
  const normalized = slug.toLowerCase().replace(/^\/+|\/+$/g, '');
  return listDemoAttorneys().find((a) => a.slug === normalized) || null;
}
