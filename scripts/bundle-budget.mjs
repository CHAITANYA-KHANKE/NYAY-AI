/**
 * scripts/bundle-budget.mjs — Zero-dependency bundle size verification.
 * Measures gzipped First Load JS against strict performance budgets.
 *
 * Usage:
 *   node scripts/bundle-budget.mjs           # Fails process with code 1 on budget breach
 *   node scripts/bundle-budget.mjs --report  # Prints metrics table without failing
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const NEXT_DIR = join(ROOT_DIR, '.next');

const isReportOnly = process.argv.includes('--report');

// Budgets in kB (env-overridable)
const BUDGETS_KB = {
  shared: Number(process.env.BUNDLE_BUDGET_SHARED || 88),
  home: Number(process.env.BUNDLE_BUDGET_HOME || 100),
  dashboard: Number(process.env.BUNDLE_BUDGET_DASHBOARD || 106),
};

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

function getGzipSize(relativePath) {
  const fullPath = join(NEXT_DIR, relativePath);
  if (!existsSync(fullPath)) return 0;
  const buffer = readFileSync(fullPath);
  return gzipSync(buffer).length;
}

function run() {
  const appManifestPath = join(NEXT_DIR, 'app-build-manifest.json');
  const buildManifestPath = join(NEXT_DIR, 'build-manifest.json');

  if (!existsSync(appManifestPath) || !existsSync(buildManifestPath)) {
    console.error('Build artifacts not found. Please run "next build" before running bundle budget check.');
    process.exit(1);
  }

  const appManifest = JSON.parse(readFileSync(appManifestPath, 'utf8'));
  const buildManifest = JSON.parse(readFileSync(buildManifestPath, 'utf8'));

  // Collect root shared main files (Next.js First Load JS shared by all)
  const rootFiles = new Set(buildManifest.rootMainFiles || []);

  const sharedBytesMap = new Map();
  let totalSharedBytes = 0;

  for (const file of rootFiles) {
    const size = getGzipSize(file);
    sharedBytesMap.set(file, size);
    totalSharedBytes += size;
  }

  const routes = [
    {
      name: '/',
      keys: ['/page', '/'],
      budgetKb: BUDGETS_KB.home,
    },
    {
      name: '/dashboard',
      keys: ['/dashboard/page', '/dashboard'],
      budgetKb: BUDGETS_KB.dashboard,
    },
  ];

  let hasBreach = false;
  const rows = [];

  // Evaluate shared baseline
  const sharedBreached = totalSharedBytes > BUDGETS_KB.shared * 1024;
  if (sharedBreached) hasBreach = true;

  rows.push({
    Target: 'Shared (rootMainFiles)',
    'Route Chunks (gz)': '-',
    'First Load JS (gz)': formatKb(totalSharedBytes),
    'Budget (gz)': `≤ ${BUDGETS_KB.shared} kB`,
    Status: sharedBreached ? '❌ EXCEEDED' : '✅ PASS',
  });

  for (const route of routes) {
    let routeFiles = [];
    for (const key of route.keys) {
      if (appManifest.pages && appManifest.pages[key]) {
        routeFiles = appManifest.pages[key];
        break;
      }
    }

    const uniqueRouteFiles = routeFiles.filter((file) => !rootFiles.has(file));
    let routeChunkBytes = 0;
    const allFilesForRoute = new Set([...rootFiles, ...routeFiles]);
    let totalFirstLoadBytes = 0;

    for (const file of uniqueRouteFiles) {
      routeChunkBytes += getGzipSize(file);
    }

    for (const file of allFilesForRoute) {
      totalFirstLoadBytes += getGzipSize(file);
    }

    const breached = totalFirstLoadBytes > route.budgetKb * 1024;
    if (breached) hasBreach = true;

    rows.push({
      Target: route.name,
      'Route Chunks (gz)': formatKb(routeChunkBytes),
      'First Load JS (gz)': formatKb(totalFirstLoadBytes),
      'Budget (gz)': `≤ ${route.budgetKb} kB`,
      Status: breached ? '❌ EXCEEDED' : '✅ PASS',
    });
  }

  console.log('\n📊 Next.js Bundle Budget Verification');
  console.table(rows);

  if (hasBreach && !isReportOnly) {
    console.error('❌ Bundle budget check failed: One or more routes exceeded their First Load JS budget.\n');
    process.exit(1);
  } else if (hasBreach && isReportOnly) {
    console.warn('⚠️ Bundle budget warning: Metrics exceeded targets, but --report flag was specified.\n');
  } else {
    console.log('✅ All routes are within First Load JS performance budgets!\n');
  }
}

run();
