// Browser-only viewport coverage with mocked auth/dashboard APIs; no live account or broker calls.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer';

const baseUrl = process.env.TCE_APP_URL ?? 'http://127.0.0.1:3000';
const origin = new URL(baseUrl).origin;
const artifactDirectory = resolve('artifacts/pools-mobile');
mkdirSync(artifactDirectory, { recursive: true });

const mockUser = {
  id: 'pools-viewport-test-user',
  email: 'pools-viewport-test@example.invalid',
  role: 'ADMIN',
  mfaEnabled: false,
};

function apiPayload(pathname) {
  if (pathname === '/api/dashboard') {
    return {
      account: {
        totalValue: 30000000,
        capital_available: 12000000,
        capital_deployed: 15000000,
      },
      positions: [
        {
          id: 'viewport-fpt-position',
          symbol: 'FPT',
          positionPrice: 100,
          currentPrice: 102,
          quantity: 100,
          costBasis: 10000,
          pool: 'A',
          slot: '1',
          sellableAt: 'T+2',
        },
      ],
      pools: [],
      nextPositions: [],
      orders: [],
      brokerAccounts: [],
    };
  }
  if (pathname === '/api/stock-events') return [];
  if (pathname.includes('market-prices')) return { data: [] };
  if (pathname.endsWith('/engines')) return [];
  if (pathname.endsWith('/telegram-bots')) return { bots: [] };
  if (pathname.endsWith('/telegram-debug-assignments')) return { assignments: [] };
  if (
    pathname.endsWith('/positions') ||
    pathname.endsWith('/pools') ||
    pathname.endsWith('/orders')
  ) {
    return [];
  }
  return {};
}

const cases = [
  { name: 'portrait-390x844', width: 390, height: 844, landscape: false },
  { name: 'landscape-844x430', width: 844, height: 430, landscape: true },
  { name: 'short-landscape-844x390', width: 844, height: 390, landscape: true },
];

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  for (const testCase of cases) {
    const page = await browser.newPage();
    await page.setViewport({
      width: testCase.width,
      height: testCase.height,
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const diagnostics = { api: [], auth: [], consoleErrors: [], pageErrors: [] };
    page.on('response', response => {
      try {
        const url = new URL(response.url());
        if (url.origin === origin && url.pathname.startsWith('/api/')) {
          diagnostics.api.push({ path: url.pathname, status: response.status() });
        }
        if (url.origin === origin && url.pathname.startsWith('/auth/')) {
          diagnostics.auth.push({ path: url.pathname, status: response.status() });
        }
      } catch {}
    });
    page.on('console', message => {
      if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
    });
    page.on('pageerror', error => diagnostics.pageErrors.push(String(error)));
    const dashboardResponsePromise = page
      .waitForResponse(
        response => {
          const url = new URL(response.url());
          return url.origin === origin && url.pathname === '/api/dashboard';
        },
        { timeout: 90_000 }
      )
      .catch(() => null);

    await page.setRequestInterception(true);
    page.on('request', request => {
      let url;
      try {
        url = new URL(request.url());
      } catch {
        void request.continue().catch(() => {});
        return;
      }

      if (url.origin === origin && url.pathname.startsWith('/auth/')) {
        const body = url.pathname === '/auth/me' ? { user: mockUser } : { ok: true };
        void request
          .respond({
            status: 200,
            contentType: 'application/json',
            headers: { 'cache-control': 'no-store' },
            body: JSON.stringify(body),
          })
          .catch(() => {});
        return;
      }

      if (url.origin === origin && url.pathname.startsWith('/api/')) {
        void request
          .respond({
            status: 200,
            contentType: 'application/json',
            headers: { 'cache-control': 'no-store' },
            body: JSON.stringify(apiPayload(url.pathname)),
          })
          .catch(() => {});
        return;
      }

      if (url.protocol === 'ws:' || url.protocol === 'wss:') {
        void request.abort().catch(() => {});
        return;
      }

      if (url.origin === origin || url.protocol === 'data:' || url.protocol === 'blob:') {
        void request.continue().catch(() => {});
        return;
      }

      void request.abort().catch(() => {});
    });

    try {
      await page.goto(`${baseUrl}/pools`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      const dashboardResponse = await dashboardResponsePromise;
      if (!dashboardResponse) {
        throw new Error(`Dashboard API was not observed: ${JSON.stringify(diagnostics)}`);
      }
      console.log(
        `Observed dashboard API status ${dashboardResponse.status()} for ${testCase.name}`
      );
      await page.waitForSelector('.tce-pools-view .tce-pool-balance', { timeout: 90_000 });
      try {
        await page.waitForSelector('.tce-pools-view .tce-rotation-row', { timeout: 30_000 });
      } catch (error) {
        const pageState = await page.evaluate(() => ({
          path: window.location.pathname,
          text: document.body.innerText.slice(0, 800),
          poolCards: document.querySelectorAll('.tce-pools-view .tce-pool-balance').length,
          rotationRows: document.querySelectorAll('.tce-pools-view .tce-rotation-row').length,
        }));
        throw new Error(
          `Pools data did not render a rotation row: ${JSON.stringify({ pageState, diagnostics })}; ${String(error)}`
        );
      }

      const metrics = await page.evaluate(() => {
        const query = selector => document.querySelector(selector);
        const style = element => (element ? getComputedStyle(element) : null);
        const poolsView = query('.tce-pools-view');
        const header = query('.tce-pools-view > .tce-mobile-header');
        const statusCard = query('.tce-pools-view > .tce-status-card');
        const content = query('.dashboard-layout > .app-content');
        const nav = query('.tce-bottom-tabs');
        const poolGrid = query('.tce-pool-balance-grid');
        const rotationGrid = query('.tce-rotation-kpis');
        const poolCards = [...document.querySelectorAll('.tce-pool-balance')];
        const rotationMetrics = [...document.querySelectorAll('.tce-rotation-kpis > div')];
        const sections = [...document.querySelectorAll('.tce-pools-view .tce-section')];
        const navRect = nav?.getBoundingClientRect();
        const headerRect = header?.getBoundingClientRect();
        const statusRect = statusCard?.getBoundingClientRect();
        return {
          width: window.innerWidth,
          height: window.innerHeight,
          documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
          headerTop: headerRect?.top ?? null,
          headerBottom: headerRect?.bottom ?? null,
          statusTop: statusRect?.top ?? null,
          navTop: navRect?.top ?? null,
          navBottom: navRect?.bottom ?? null,
          navPosition: style(nav)?.position ?? null,
          poolColumns: style(poolGrid)?.gridTemplateColumns.trim().split(' ').length ?? 0,
          poolCount: poolCards.length,
          poolCardsWithinViewport: poolCards.every(card => {
            const rect = card.getBoundingClientRect();
            return rect.left >= -1 && rect.right <= window.innerWidth + 1;
          }),
          rotationColumns: style(rotationGrid)?.gridTemplateColumns.trim().split(' ').length ?? 0,
          rotationMetricTops: rotationMetrics.map(item =>
            Math.round(item.getBoundingClientRect().top)
          ),
          rotationMetricCount: rotationMetrics.length,
          contentPaddingBottom: Number.parseFloat(style(poolsView)?.paddingBottom ?? '0'),
          lastSectionBottom: sections.at(-1)?.getBoundingClientRect().bottom ?? null,
          contentScrollHeight: content?.scrollHeight ?? 0,
          contentClientHeight: content?.clientHeight ?? 0,
        };
      });

      assert.ok(
        metrics.documentWidth <= testCase.width + 1,
        `${testCase.name}: no page-level horizontal overflow (${metrics.documentWidth}px)`
      );
      assert.equal(metrics.poolCount, 3, `${testCase.name}: all three capital pools render`);
      assert.ok(
        metrics.poolCardsWithinViewport,
        `${testCase.name}: pool cards stay within viewport bounds`
      );
      assert.equal(
        metrics.rotationColumns,
        2,
        `${testCase.name}: active rotation metrics use a two-column grid`
      );
      assert.equal(
        metrics.rotationMetricCount,
        3,
        `${testCase.name}: all three active-rotation metrics render`
      );
      assert.equal(
        metrics.rotationMetricTops[0],
        metrics.rotationMetricTops[1],
        `${testCase.name}: first two rotation metrics share a row`
      );
      assert.ok(
        metrics.rotationMetricTops[2] > metrics.rotationMetricTops[0],
        `${testCase.name}: third rotation metric wraps to the next row`
      );
      assert.ok(
        metrics.statusTop >= metrics.headerBottom - 1,
        `${testCase.name}: summary card does not overlap the page header`
      );

      if (testCase.landscape) {
        assert.equal(
          metrics.poolColumns,
          3,
          `${testCase.name}: three pool cards fit across landscape`
        );
        assert.equal(metrics.navPosition, 'fixed', `${testCase.name}: navigation remains fixed`);
        assert.ok(
          metrics.headerTop >= metrics.navBottom - 1,
          `${testCase.name}: page header clears the top navigation`
        );
      } else {
        assert.equal(
          metrics.poolColumns,
          2,
          `${testCase.name}: pools use a compact two-column grid`
        );
        assert.ok(
          metrics.contentPaddingBottom >= 128,
          'portrait: scroll content reserves space for the bottom dock and safe area'
        );
        await page.evaluate(() => {
          const content = document.querySelector('.dashboard-layout > .app-content');
          content.scrollTop = content.scrollHeight;
        });
        const bottomMetrics = await page.evaluate(() => {
          const nav = document.querySelector('.tce-bottom-tabs').getBoundingClientRect();
          const lastSection = [...document.querySelectorAll('.tce-pools-view .tce-section')]
            .at(-1)
            .getBoundingClientRect();
          return { navTop: nav.top, lastSectionBottom: lastSection.bottom };
        });
        assert.ok(
          bottomMetrics.lastSectionBottom <= bottomMetrics.navTop - 40,
          `${testCase.name}: bottom dock does not cover the final section (${JSON.stringify(bottomMetrics)})`
        );
      }

      await page.screenshot({
        path: resolve(artifactDirectory, `${testCase.name}.png`),
        fullPage: false,
      });
      console.log(`PASS POOLS ${testCase.name}: ${JSON.stringify(metrics)}`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
