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
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const cdp = await page.createCDPSession();
    const stylesheetHeaders = new Map();
    cdp.on('CSS.styleSheetAdded', ({ header }) =>
      stylesheetHeaders.set(header.styleSheetId, header)
    );
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    await page.setBypassServiceWorker(true);
    await page.setCacheEnabled(false);
    await page.setViewport({
      width: testCase.width,
      height: testCase.height,
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const diagnostics = { api: [], auth: [], requests: [], consoleErrors: [], pageErrors: [] };
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
    await page.setRequestInterception(true);
    const dashboardResponsePromise = page
      .waitForResponse(
        response => {
          const url = new URL(response.url());
          return url.origin === origin && url.pathname === '/api/dashboard';
        },
        { timeout: 20_000 }
      )
      .catch(() => null);

    page.on('request', request => {
      let url;
      try {
        url = new URL(request.url());
      } catch {
        void request.continue().catch(() => {});
        return;
      }

      if (url.origin === origin && url.pathname.startsWith('/auth/')) {
        diagnostics.requests.push({ path: url.pathname, method: request.method() });
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
        diagnostics.requests.push({ path: url.pathname, method: request.method() });
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
      await page.waitForSelector('.tce-pools-view', { timeout: 30_000 });
      await page.waitForSelector('.tce-pools-view .tce-pool-balance', { timeout: 30_000 });
      try {
        await page.waitForSelector('.tce-pools-view .tce-rotation-row', { timeout: 15_000 });
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
        const poolGrid = query('.tce-pools-view .tce-pool-balance-grid');
        const rotationGrid = query('.tce-rotation-kpis');
        const scopedRotationGrid = poolsView?.querySelector('.tce-rotation-kpis') ?? null;
        const poolCards = [...document.querySelectorAll('.tce-pools-view .tce-pool-balance')];
        const rotationMetrics = [...document.querySelectorAll('.tce-rotation-kpis > div')];
        const scopedRotationMetrics = [
          ...(poolsView?.querySelectorAll('.tce-rotation-kpis > div') ?? []),
        ];
        const sections = [...document.querySelectorAll('.tce-pools-view .tce-section')];
        const navRect = nav?.getBoundingClientRect();
        const headerRect = header?.getBoundingClientRect();
        const statusRect = statusCard?.getBoundingClientRect();
        const shortLandscapeQuery = window.matchMedia('(min-width: 600px) and (max-width: 950px)');
        const mobileWidthQuery = window.matchMedia('(max-width: 767px)');
        const landscapeQuery = window.matchMedia('(orientation: landscape)');
        const viewport = {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
          visualViewport: window.visualViewport
            ? {
                width: window.visualViewport.width,
                height: window.visualViewport.height,
                scale: window.visualViewport.scale,
              }
            : null,
        };
        const rotationGridCandidates = [...document.querySelectorAll('.tce-rotation-kpis')].map(
          (element, index) => {
            const computed = style(element);
            const rect = element.getBoundingClientRect();
            const columns = computed?.gridTemplateColumns ?? '';
            return {
              index,
              className: String(element.className),
              parentClassName: String(element.parentElement?.className ?? ''),
              insidePoolsView: Boolean(element.closest('.tce-pools-view')),
              display: computed?.display ?? null,
              gridTemplateColumns: columns,
              columnCount: columns.trim().split(/\\s+/).filter(Boolean).length,
              rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
            };
          }
        );
        const rotationComputedColumns = style(rotationGrid)?.gridTemplateColumns ?? '';
        const scopedRotationComputedColumns = style(scopedRotationGrid)?.gridTemplateColumns ?? '';
        const rotationMetricTops = rotationMetrics.map(item =>
          Math.round(item.getBoundingClientRect().top)
        );
        const scopedRotationMetricTops = scopedRotationMetrics.map(item =>
          Math.round(item.getBoundingClientRect().top)
        );

        return {
          ...viewport,
          documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
          headerTop: headerRect?.top ?? null,
          headerBottom: headerRect?.bottom ?? null,
          statusTop: statusRect?.top ?? null,
          navTop: navRect?.top ?? null,
          navBottom: navRect?.bottom ?? null,
          navPosition: style(nav)?.position ?? null,
          poolColumns: style(poolGrid)?.gridTemplateColumns.trim().split(/\\s+/).length ?? 0,
          poolCount: poolCards.length,
          poolCardsWithinViewport: poolCards.every(card => {
            const rect = card.getBoundingClientRect();
            return rect.left >= -1 && rect.right <= window.innerWidth + 1;
          }),
          rotationColumns: rotationComputedColumns.trim().split(/\\s+/).filter(Boolean).length,
          rotationComputedColumns,
          rotationGridIsInsidePoolsView: Boolean(rotationGrid?.closest('.tce-pools-view')),
          scopedRotationColumns: scopedRotationComputedColumns.trim().split(/\\s+/).filter(Boolean)
            .length,
          scopedRotationComputedColumns,
          rotationGridCandidates,
          rotationMetricTops,
          rotationMetricCount: rotationMetrics.length,
          scopedRotationMetricTops,
          scopedRotationMetricCount: scopedRotationMetrics.length,
          contentPaddingTop: Number.parseFloat(style(content)?.paddingTop ?? '0'),
          contentPaddingBottom: Number.parseFloat(style(poolsView)?.paddingBottom ?? '0'),
          mediaQueries: {
            shortLandscape: {
              query: shortLandscapeQuery.media,
              matches: shortLandscapeQuery.matches,
            },
            mobileWidth: { query: mobileWidthQuery.media, matches: mobileWidthQuery.matches },
            landscape: { query: landscapeQuery.media, matches: landscapeQuery.matches },
          },
          lastSectionBottom: sections.at(-1)?.getBoundingClientRect().bottom ?? null,
          contentScrollHeight: content?.scrollHeight ?? 0,
          contentClientHeight: content?.clientHeight ?? 0,
        };
      });

      async function matchedGridRules(selector) {
        try {
          const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
          const { nodeId } = await cdp.send('DOM.querySelector', {
            nodeId: root.nodeId,
            selector,
          });
          if (!nodeId) return { selector, found: false, matchedRules: [] };
          const response = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });
          const matchedRules = (response.matchedCSSRules ?? [])
            .map((entry, ruleOrder) => {
              const rule = entry.rule;
              const styleSheetId = rule.style?.styleSheetId ?? null;
              const header = styleSheetId ? stylesheetHeaders.get(styleSheetId) : null;
              const declarations = (rule.style?.cssProperties ?? [])
                .filter(property => property.name === 'grid-template-columns')
                .map(property => ({
                  value: property.value,
                  important: Boolean(property.important),
                  parsedOk: property.parsedOk ?? null,
                  disabled: Boolean(property.disabled),
                }));
              return {
                ruleOrder,
                selector: rule.selectorList?.text ?? null,
                matchingSelectors: entry.matchingSelectors ?? [],
                origin: rule.origin ?? null,
                styleSheetId,
                stylesheetUrl: header?.sourceURL ?? null,
                stylesheetOrigin: header?.origin ?? null,
                stylesheetStartLine: header?.startLine ?? null,
                ruleStartLine: rule.range?.startLine ?? null,
                media: (rule.media ?? []).map(item => ({
                  text: item.text,
                  source: item.source,
                })),
                declarations,
              };
            })
            .filter(rule => rule.declarations.length > 0);
          const inlineDeclarations = (response.inlineStyle?.cssProperties ?? [])
            .filter(property => property.name === 'grid-template-columns')
            .map(property => ({
              value: property.value,
              important: Boolean(property.important),
              disabled: Boolean(property.disabled),
            }));
          return {
            selector,
            found: true,
            matchedRules: matchedRules.slice(0, 40),
            inlineDeclarations,
          };
        } catch (error) {
          return { selector, error: String(error) };
        }
      }

      const cdpRuleDiagnostics = {
        unscoped: await matchedGridRules('.tce-rotation-kpis'),
        scoped: await matchedGridRules('.tce-pools-view .tce-rotation-kpis'),
      };
      const usedStyleSheetIds = new Set(
        [
          ...(cdpRuleDiagnostics.unscoped.matchedRules ?? []),
          ...(cdpRuleDiagnostics.scoped.matchedRules ?? []),
        ]
          .map(rule => rule.styleSheetId)
          .filter(Boolean)
      );
      const relevantStyleSheets = [...stylesheetHeaders.values()]
        .filter(header => usedStyleSheetIds.has(header.styleSheetId))
        .map(header => ({
          styleSheetId: header.styleSheetId,
          sourceURL: header.sourceURL ?? null,
          origin: header.origin ?? null,
          startLine: header.startLine ?? null,
          endLine: header.endLine ?? null,
        }));
      const diagnostic = { viewport: testCase, metrics, cdpRuleDiagnostics, relevantStyleSheets };
      console.log(
        `TCE-UI-003A CSS cascade diagnostic ${testCase.name}: ${JSON.stringify(diagnostic)}`
      );
      await page.screenshot({
        path: resolve(artifactDirectory, `${testCase.name}.png`),
        fullPage: false,
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
        `${testCase.name}: active rotation metrics use a two-column grid; see the TCE-UI-003A CSS cascade diagnostic log above`
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
        metrics.statusTop >= metrics.contentPaddingTop - 1,
        `${testCase.name}: summary card clears the shared safe-area/top chrome`
      );

      if (testCase.landscape) {
        assert.equal(
          metrics.shortLandscapeQueryMatches,
          true,
          `${testCase.name}: compact landscape media query matches viewport dimensions`
        );
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

      console.log(`PASS POOLS ${testCase.name}: ${JSON.stringify(metrics)}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
