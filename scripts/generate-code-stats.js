#!/usr/bin/env node

/**
 * Render a self-contained Code::Stats SVG from the public profile endpoint.
 *
 * Usage:
 *   node scripts/generate-code-stats.js <username> <output-file> <language-color-json> <light|dark>
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { mkdir, writeFile} from 'node:fs/promises';
import { dirname } from 'node:path';

const [username, outputFile, colorFile, themeName = 'light'] = process.argv.slice(2);
if (!username || !outputFile || !colorFile || !['light', 'dark'].includes(themeName)) {
  console.error('Usage: node scripts/generate-code-stats.js <username> <output-file> <language-color-json> <light|dark>');
  process.exit(1);
}

const endpoint = `https://codestats.net/api/users/${encodeURIComponent(username)}`;
const number = new Intl.NumberFormat('en-US');
const colors = JSON.parse(readFileSync(colorFile, 'utf-8'));
const fallbackColors = ['#38BDF8', '#0EA5E9', '#60A5FA', '#818CF8', '#22D3EE'];
const themes = {
  light: {
    background: '#ffffff', foreground: '#18181b', muted: '#52525b',
    panel: '#f4f4f5', grid: '#d4d4d8', accent: '#0284C7',
  },
  dark: {
    background: '#0a0a0b', foreground: '#f4f4f5', muted: '#a1a1aa',
    panel: '#18181b', grid: '#3f3f46', accent: '#38BDF8',
  },
};
const theme = themes[themeName];

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, (character) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  }[character]));
}

function formatXp(value) {
  return number.format(Math.round(Number(value) || 0));
}

function levelFor(xp) {
  return Math.floor(0.025 * Math.sqrt(Number(xp) || 0));
}

function utcDateOffset(daysAgo) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function renderChart(dates) {
  const values = Array.from({ length: 14 }, (_, index) => {
    const date = utcDateOffset(13 - index);
    return { date, xp: Number(dates[date]) || 0 };
  });
  const max = Math.max(1, ...values.map(({ xp }) => xp));
  const x = 46;
  const y = 252;
  const width = 808;
  const height = 102;
  const gap = 8;
  const barWidth = (width - gap * (values.length - 1)) / values.length;
  const lines = [0, 0.5, 1].map((ratio) => {
    const lineY = y + height - height * ratio;
    return `<line x1="${x}" y1="${lineY}" x2="${x + width}" y2="${lineY}" stroke="${theme.grid}" stroke-width="1" />`;
  }).join('');
  const bars = values.map(({ date, xp }, index) => {
    const barHeight = xp ? Math.max(3, (xp / max) * height) : 0;
    const barX = x + index * (barWidth + gap);
    const barY = y + height - barHeight;
    const label = date.slice(5).replace('-', '/');
    return `
      <rect x="${barX.toFixed(2)}" y="${barY.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" rx="3" fill="${theme.accent}">
        <title>${escapeXml(`${date}: ${formatXp(xp)} XP`)}</title>
      </rect>
      ${(index === 0 || index === values.length - 1 || index === 6) ? `<text x="${(barX + barWidth / 2).toFixed(2)}" y="370" text-anchor="middle" class="axis">${label}</text>` : ''}`;
  }).join('');

  return { lines, bars, max };
}

function renderSvg(profile) {
  const totalXp = Number(profile.total_xp) || 0;
  const newXp = Number(profile.new_xp) || 0;
  const languages = Object.entries(profile.languages || {})
    .map(([language, stats]) => ({ language, xp: Number(stats.xps) || 0 }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 6);
  const chart = renderChart(profile.dates || {});
  const languageRows = languages.map(({ language, xp }, index) => {
    const rowY = 118 + index * 18;
    const percent = totalXp ? (xp / totalXp) * 100 : 0;
    // Code::Stats can report editor-specific names (for example, `scminput`)
    // which are intentionally absent from GitHub's language-color catalogue.
    const color = colors[language]?.color || fallbackColors[index % fallbackColors.length];
    return `<circle cx="595" cy="${rowY - 4}" r="4" fill="${color}" />
      <text x="606" y="${rowY}" class="language">${escapeXml(language)}</text>
      <text x="850" y="${rowY}" text-anchor="end" class="language value">${formatXp(xp)} · ${percent.toFixed(1)}%</text>\n`;
  }).join('') || '<text x="595" y="118" class="language">No language data yet</text>';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="400" viewBox="0 0 900 400" role="img" aria-labelledby="title description">
  <title id="title">${escapeXml(profile.user || username)}'s Code::Stats</title>
  <desc id="description">Code::Stats summary with total experience, current level, top languages, and the last 14 days of XP.</desc>
  <style>
    .title { font: 700 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: ${theme.foreground}; }
    .subtitle { font: 500 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: ${theme.muted}; letter-spacing: .04em; }
    .metric-label { font: 600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: ${theme.muted}; letter-spacing: .08em; }
    .metric-value { font: 700 29px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: ${theme.foreground}; }
    .section { font: 700 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: ${theme.foreground}; letter-spacing: .05em; }
    .language, .axis { font: 500 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: ${theme.muted}; }
    .value { font-weight: 600; fill: ${theme.foreground}; }
  </style>
  <rect width="900" height="400" rx="18" fill="${theme.background}" />
  <rect x="1" y="1" width="898" height="398" rx="17" fill="none" stroke="${theme.grid}" stroke-width="2" />
  <text x="46" y="50" class="title">Code::Stats</text>
  <text x="854" y="50" text-anchor="end" class="subtitle">@${escapeXml(profile.user || username)}</text>
  <line x1="46" y1="70" x2="854" y2="70" stroke="${theme.grid}" />

  <text x="46" y="95" class="metric-label">TOTAL XP</text>
  <text x="46" y="130" class="metric-value">${formatXp(totalXp)}</text>
  <text x="261" y="95" class="metric-label">LEVEL</text>
  <text x="261" y="130" class="metric-value">${levelFor(totalXp)}</text>
  <text x="420" y="95" class="metric-label">LAST 12 HOURS</text>
  <text x="420" y="130" class="metric-value">+${formatXp(newXp)}</text>

  <text x="590" y="95" class="section">TOP LANGUAGES</text>
  ${languageRows}

  <text x="46" y="240" class="section">XP · LAST 14 DAYS</text>
  <text x="854" y="240" text-anchor="end" class="axis">PEAK ${formatXp(chart.max)} XP</text>
  ${chart.lines}
  ${chart.bars}
</svg>`;
}

async function fetchProfile() {
  const attempts = 3;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        throw new Error(`Code::Stats API returned ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      const reason = error.cause?.code ? ` (${error.cause.code})` : '';
      console.warn(`Code::Stats request ${attempt}/${attempts} failed: ${error.message}${reason}`);
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
      }
    }
  }

  const reason = lastError.cause?.message || lastError.message;
  throw new Error(`Code::Stats API could not be reached after ${attempts} attempts: ${reason}`);
}

async function main() {
  const profile = await fetchProfile();
  if (!profile || typeof profile !== 'object') {
    throw new Error('Code::Stats API returned an invalid response');
  }

  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${renderSvg(profile)}\n`, 'utf8');
  console.log(`Generated ${outputFile} from ${endpoint}`);
}

main().catch((error) => {
  console.error(`Unable to generate Code::Stats card: ${error.message}`);
  process.exitCode = 1;
});
