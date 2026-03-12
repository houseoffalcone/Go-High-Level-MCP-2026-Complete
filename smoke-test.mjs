// GHL MCP Server — New Endpoints Smoke Test (READ-ONLY)
// Writes results to /Users/jakeshore/.clawdbot/workspace/ghl-smoke-test-results.md

import { writeFileSync } from 'fs';

const API_KEY    = 'pit-ad4c6ee1-82e6-48e4-ba7e-e05375380d6e';
const LOC_ID     = 'DZEpRd43MxUJKdtrev9t';
const COMPANY_ID = 'D7tkK8E9XMoQeEQVHvu1';
const BASE_URL   = 'https://services.leadconnectorhq.com';

const HEADERS = {
  'Authorization': `Bearer ${API_KEY}`,
  'Version': '2021-07-28',
  'Content-Type': 'application/json',
};

const ENDPOINTS = [
  // Voice AI
  { group: 'Voice AI', label: 'List voice agents',      path: `/voice-ai/agents?locationId=${LOC_ID}` },
  { group: 'Voice AI', label: 'Call logs dashboard',    path: `/voice-ai/dashboard/call-logs?locationId=${LOC_ID}` },

  // Proposals
  { group: 'Proposals', label: 'List proposal documents', path: `/proposals/document?locationId=${LOC_ID}` },
  { group: 'Proposals', label: 'List proposal templates', path: `/proposals/templates?locationId=${LOC_ID}` },

  // Custom Menus
  { group: 'Custom Menus', label: 'List custom menus',   path: `/custom-menus/?companyId=${COMPANY_ID}` },

  // Marketplace Billing
  { group: 'Marketplace', label: 'Billing charges list',       path: `/marketplace/billing/charges?locationId=${LOC_ID}` },
  { group: 'Marketplace', label: 'Billing charges has-funds',  path: `/marketplace/billing/charges/has-funds?locationId=${LOC_ID}` },

  // Phone System
  { group: 'Phone System', label: 'Number pools',              path: `/phone-system/number-pools?locationId=${LOC_ID}` },
  { group: 'Phone System', label: 'Numbers by location',       path: `/phone-system/numbers/location/${LOC_ID}` },

  // SaaS
  { group: 'SaaS', label: 'Agency plans',                      path: `/saas-api/public-api/agency-plans/${COMPANY_ID}` },
  { group: 'SaaS', label: 'SaaS subscription (location)',      path: `/saas-api/public-api/get-saas-subscription/${LOC_ID}` },
  { group: 'SaaS', label: 'SaaS locations',                    path: `/saas-api/public-api/saas-locations/${COMPANY_ID}` },

  // Media
  { group: 'Media', label: 'Media files (location)',           path: `/medias/files?altType=location&altId=${LOC_ID}&type=file&limit=1` },

  // Links
  { group: 'Links', label: 'Search links',                     path: `/links/search?locationId=${LOC_ID}&query=test` },

  // Payments
  { group: 'Payments', label: 'List orders',                   path: `/payments/orders?locationId=${LOC_ID}&limit=1` },

  // Snapshots
  { group: 'Snapshots', label: 'List snapshots',               path: `/snapshots/?companyId=${COMPANY_ID}` },
];

function statusIcon(status) {
  if (status === 200 || status === 201) return '✅';
  if (status === 401 || status === 403) return '⚠️';
  return '❌';
}

// Per-endpoint auth notes (keyed by label)
const AUTH_NOTES = {
  'List custom menus':             'Requires an **OAuth app token** with `custom-menus.readonly` scope. Private Integration Tokens do not have this scope.',
  'Agency plans':                  'Requires an **agency-level OAuth token** (not a location API key). Scoped to the agency/company, not a sub-account.',
  'SaaS subscription (location)':  'Requires an **agency-level OAuth token** with SaaS scope. PITs from sub-accounts are not authorized.',
  'SaaS locations':                'Requires an **agency-level OAuth token** with SaaS scope.',
  'List orders':                   'Returns 403 for Private Integration Tokens — likely requires an **OAuth token** with `payments/orders.readonly` scope.',
  'List snapshots':                'Requires an **OAuth app token** with `snapshots.readonly` scope — not available on PITs.',
};

function authNote(status, body, label) {
  if ((status === 401 || status === 403) && AUTH_NOTES[label]) {
    return `_${AUTH_NOTES[label]}_`;
  }
  if (status === 401 || status === 403) {
    return '_May require OAuth app token rather than Private Integration Token (API key)_';
  }
  return '';
}

async function testEndpoint(ep) {
  const url = `${BASE_URL}${ep.path}`;
  const start = Date.now();
  try {
    const res = await fetch(url, { method: 'GET', headers: HEADERS });
    const elapsed = Date.now() - start;
    let body;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await res.json();
    } else {
      body = await res.text();
    }

    let dataNote = '';
    if (res.ok) {
      if (typeof body === 'object' && body !== null) {
        const keys = Object.keys(body);
        const topKey = keys[0];
        const val = body[topKey];
        if (Array.isArray(val)) {
          dataNote = `${val.length} item(s) in \`.${topKey}\``;
        } else if (topKey) {
          dataNote = `Response keys: ${keys.join(', ')}`;
        } else {
          dataNote = 'Empty object returned';
        }
      } else {
        dataNote = `Raw text (${String(body).slice(0, 80)})`;
      }
    } else {
      const errMsg = typeof body === 'object'
        ? (body.message || body.error || body.msg || JSON.stringify(body).slice(0, 120))
        : String(body).slice(0, 120);
      dataNote = `Error: ${errMsg}`;
    }

    return { ...ep, url, status: res.status, elapsed, dataNote, body };
  } catch (err) {
    return { ...ep, url, status: 0, elapsed: Date.now() - start, dataNote: `Network error: ${err.message}`, body: null };
  }
}

async function main() {
  console.log(`\nGHL Smoke Test — ${ENDPOINTS.length} endpoints\n`);
  console.log(`Base URL : ${BASE_URL}`);
  console.log(`Location : ${LOC_ID}`);
  console.log(`Company  : ${COMPANY_ID}`);
  console.log('─'.repeat(70));

  const results = [];
  for (const ep of ENDPOINTS) {
    const r = await testEndpoint(ep);
    results.push(r);
    const icon = statusIcon(r.status);
    console.log(`${icon} [${r.status || 'ERR'}] ${r.group} › ${r.label}`);
    console.log(`   ${r.dataNote}`);
  }

  console.log('\n' + '─'.repeat(70));

  // Build markdown report
  let md = `# GHL MCP Server — New Endpoints Smoke Test Results\n\n`;
  md += `**Date:** ${new Date().toISOString()}\n`;
  md += `**Base URL:** \`${BASE_URL}\`\n`;
  md += `**Location ID:** \`${LOC_ID}\`\n`;
  md += `**Company ID:** \`${COMPANY_ID}\`\n\n`;

  md += `## Summary\n\n`;
  const pass = results.filter(r => r.status === 200 || r.status === 201).length;
  const auth = results.filter(r => r.status === 401 || r.status === 403).length;
  const fail = results.length - pass - auth;
  md += `| Result | Count |\n|--------|-------|\n`;
  md += `| ✅ Working (200/201) | ${pass} |\n`;
  md += `| ⚠️ Auth issue (401/403) | ${auth} |\n`;
  md += `| ❌ Error (other) | ${fail} |\n\n`;

  // Group by group
  const groups = [...new Set(results.map(r => r.group))];
  for (const group of groups) {
    md += `## ${group}\n\n`;
    md += `| Status | Endpoint | Notes |\n|--------|----------|-------|\n`;
    for (const r of results.filter(x => x.group === group)) {
      const icon = statusIcon(r.status);
      const note = authNote(r.status, r.body, r.label) || r.dataNote.replace(/\|/g, '\\|');
      md += `| ${icon} \`${r.status || 'ERR'}\` | \`${r.path.replace(/\|/g, '\\|')}\` | ${note} |\n`;
    }
    md += '\n';
  }

  md += `## Raw Details\n\n`;
  for (const r of results) {
    const icon = statusIcon(r.status);
    md += `### ${icon} ${r.group} › ${r.label}\n\n`;
    md += `- **URL:** \`${r.url}\`\n`;
    md += `- **Status:** \`${r.status}\`\n`;
    md += `- **Time:** ${r.elapsed}ms\n`;
    md += `- **Notes:** ${r.dataNote}\n`;
    if (r.status === 401 || r.status === 403) {
      const specific = AUTH_NOTES[r.label];
      md += `- **⚠️ Auth:** ${specific || 'This endpoint likely requires an OAuth app token (not a Private Integration Token / API key).'}\n`;
    }
    md += '\n';
  }

  const outPath = '/Users/jakeshore/.clawdbot/workspace/ghl-smoke-test-results.md';
  writeFileSync(outPath, md, 'utf8');
  console.log(`\n✅ Results written to: ${outPath}\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
