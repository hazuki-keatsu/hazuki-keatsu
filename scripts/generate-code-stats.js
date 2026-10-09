#!/usr/bin/env node

/**
 * Render a self-contained Code::Stats SVG from the public profile endpoint.
 *
 * Usage:
 *   node scripts/generate-code-stats.js <username> <output-file>
 */

const fs = require('node:fs/promises');
const path = require('node:path');

const [username, outputFile] = process.argv.slice(2);
if (!username || !outputFile) {
  console.error('Usage: node scripts/generate-code-stats.js <username> <output-file>');
  process.exit(1);
}

const endpoint = `https://codestats.net/api/users/${encodeURIComponent(username)}`;
const number = new Intl.NumberFormat('en-US');
const colors = ['#9c404c', '#c56a77', '#d9959f', '#755260', '#bb7c48', '#8b6b9e'];

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
  const y = 294;
  const width = 808;
  const height = 102;
  const gap = 8;
  const barWidth = (width - gap * (values.length - 1)) / values.length;
  const lines = [0, 0.5, 1].map((ratio) => {
    const lineY = y + height - height * ratio;
    return `<line x1="${x}" y1="${lineY}" x2="${x + width}" y2="${lineY}" stroke="#eadde0" stroke-width="1" />`;
  }).join('');
  const bars = values.map(({ date, xp }, index) => {
    const barHeight = xp ? Math.max(3, (xp / max) * height) : 0;
    const barX = x + index * (barWidth + gap);
    const barY = y + height - barHeight;
    const label = date.slice(5).replace('-', '/');
    return `
      <rect x="${barX.toFixed(2)}" y="${barY.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" rx="3" fill="#9c404c">
        <title>${escapeXml(`${date}: ${formatXp(xp)} XP`)}</title>
      </rect>
      ${(index === 0 || index === values.length - 1 || index === 6) ? `<text x="${(barX + barWidth / 2).toFixed(2)}" y="418" text-anchor="middle" class="axis">${label}</text>` : ''}`;
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
    const rowY = 185 + index * 18;
    const percent = totalXp ? (xp / totalXp) * 100 : 0;
    return `<circle cx="595" cy="${rowY - 4}" r="4" fill="${colors[index]}" />
      <text x="606" y="${rowY}" class="language">${escapeXml(language)}</text>
      <text x="850" y="${rowY}" text-anchor="end" class="language value">${formatXp(xp)} · ${percent.toFixed(1)}%</text>`;
  }).join('') || '<text x="595" y="185" class="language">No language data yet</text>';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="450" viewBox="0 0 900 450" role="img" aria-labelledby="title description">
  <title id="title">${escapeXml(profile.user || username)}'s Code::Stats</title>
  <desc id="description">Code::Stats summary with total experience, current level, top languages, and the last 14 days of XP.</desc>
  <style>
    .title { font: 700 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: #30252a; }
    .subtitle { font: 500 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: #806b72; letter-spacing: .04em; }
    .metric-label { font: 600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: #806b72; letter-spacing: .08em; }
    .metric-value { font: 700 29px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: #30252a; }
    .section { font: 700 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: #564148; letter-spacing: .05em; }
    .language, .axis { font: 500 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: #705d64; }
    .value { font-weight: 600; fill: #49383e; }
  </style>
  <rect width="900" height="450" rx="18" fill="#fffafb" />
  <rect x="1" y="1" width="898" height="448" rx="17" fill="none" stroke="#eadde0" stroke-width="2" />
  <text x="46" y="55" class="title">Code::Stats</text>
  <text x="46" y="78" class="subtitle">${escapeXml(profile.user || username)} · LIVE CODING ACTIVITY</text>
  <line x1="46" y1="104" x2="854" y2="104" stroke="#eadde0" />

  <text x="46" y="134" class="metric-label">TOTAL XP</text>
  <text x="46" y="169" class="metric-value">${formatXp(totalXp)}</text>
  <text x="261" y="134" class="metric-label">LEVEL</text>
  <text x="261" y="169" class="metric-value">${levelFor(totalXp)}</text>
  <text x="420" y="134" class="metric-label">LAST 12 HOURS</text>
  <text x="420" y="169" class="metric-value">+${formatXp(newXp)}</text>

  <text x="595" y="134" class="section">TOP LANGUAGES</text>
  ${languageRows}

  <text x="46" y="264" class="section">XP · LAST 14 DAYS</text>
  <text x="854" y="264" text-anchor="end" class="axis">PEAK ${formatXp(chart.max)} XP</text>
  ${chart.lines}
  ${chart.bars}
</svg>`;
}

async function main() {
  const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Code::Stats API returned ${response.status} ${response.statusText}`);
  }
  const profile = await response.json();
  if (!profile || typeof profile !== 'object') {
    throw new Error('Code::Stats API returned an invalid response');
  }

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, `${renderSvg(profile)}\n`, 'utf8');
  console.log(`Generated ${outputFile} from ${endpoint}`);
}

main().catch((error) => {
  console.error(`Unable to generate Code::Stats card: ${error.message}`);
  process.exitCode = 1;
});
