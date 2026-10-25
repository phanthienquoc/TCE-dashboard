import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer';

const baseUrl = process.env.TCE_APP_URL ?? 'http://127.0.0.1:3000';
const origin = new URL(baseUrl).origin;
const artifactDirectory = resolve('artifacts/mobile-landscape-app');
mkdirSync(artifactDirectory, { recursive: true });

const mockUser = {
  id: 'viewport-test-admin',
  email: 'viewport-test@example.invalid',
  role: 'ADMIN',
  mfaEnabled: false,
};

function apiPayload(pathname) {
  if (pathname === '/api/dashboard') {
    return {
      account: {},
      positions: [],
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
  )
    return [];
  return {};
}

const cases = [
  { name: 'portrait-390x844', width: 390, height: 844, landscape: false },
  { name: 'landscape-844x430', width: 844, height: 430, landscape: true },
  { name: 'short-landscape-844x390', width: 844, height: 390, landscape: true },
  { name: 'desktop-1280x800', width: 1280, height: 800, landscape: false },
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
      isMobile: testCase.width <= 950,
      hasTouch: testCase.width <= 950,
    });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
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
      await page.goto(`${baseUrl}/position`, {
        waitUntil: 'domcontentloaded',
        timeout: 120_000,
      });
      await page.waitForSelector('.tce-mobile-view', { timeout: 90_000 });

      const metrics = await page.evaluate(() => {
        const query = selector => document.querySelector(selector);
        const style = element => (element ? getComputedStyle(element) : null);
        const nav = query('.tce-bottom-tabs');
        const navInner = query('.tce-bottom-tabs-inner');
        const shell = query('.app-shell');
        const content = query('.dashboard-layout > .app-content');
        const mobileView = query('.tce-mobile-view');
        const heading = query('.page-heading');
        return {
          width: window.innerWidth,
          height: window.innerHeight,
          navPosition: style(nav)?.position ?? null,
          navTop: nav?.getBoundingClientRect().top ?? null,
          navBottom: nav?.getBoundingClientRect().bottom ?? null,
          navHeight: Number.parseFloat(style(nav)?.height ?? '0'),
          navGridColumns: style(navInner)?.gridTemplateColumns.trim().split(' ').length ?? 0,
          navItemCount: navInner?.querySelectorAll('.tce-bottom-tab').length ?? 0,
          navItemsWithinNav:
            Boolean(nav && navInner) &&
            [...navInner.querySelectorAll('.tce-bottom-tab')].every(item => {
              const itemRect = item.getBoundingClientRect();
              const navRect = nav.getBoundingClientRect();
              return itemRect.top >= navRect.top - 1 && itemRect.bottom <= navRect.bottom + 1;
            }),
          headerTitleColor: style(query('.tce-mobile-header strong'))?.color ?? null,
          shellHeight: Number.parseFloat(style(shell)?.height ?? '0'),
          contentOverflowY: style(content)?.overflowY ?? null,
          mobileViewMaxWidth: style(mobileView)?.maxWidth ?? null,
          mobileViewWidth: mobileView?.getBoundingClientRect().width ?? 0,
          pageHeadingDisplay: style(heading)?.display ?? null,
          documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
          visibleText: document.body.innerText.slice(0, 180),
        };
      });

      assert.ok(
        metrics.documentWidth <= testCase.width + 1,
        `${testCase.name}: full application has horizontal overflow (${metrics.documentWidth}px)`
      );

      assert.equal(metrics.navGridColumns, 7, `${testCase.name}: seven navigation columns`);
      assert.equal(
        metrics.navItemCount,
        7,
        `${testCase.name}: all seven navigation items are rendered`
      );
      assert.equal(
        metrics.navItemsWithinNav,
        true,
        `${testCase.name}: all navigation items fit inside the dock`
      );

      if (testCase.landscape) {
        assert.equal(
          metrics.headerTitleColor,
          'rgb(242, 247, 248)',
          `${testCase.name}: landscape header text has the intended high-contrast color`
        );
        assert.equal(metrics.navPosition, 'fixed', `${testCase.name}: navigation is fixed`);
        assert.ok(
          Math.abs(metrics.navTop) <= 1,
          `${testCase.name}: navigation starts at the viewport top`
        );
        assert.ok(
          Math.abs(metrics.shellHeight - testCase.height) <= 1,
          `${testCase.name}: shell fills viewport`
        );
        assert.equal(
          metrics.contentOverflowY,
          'auto',
          `${testCase.name}: content is the vertical scroll container`
        );
        assert.equal(
          metrics.mobileViewMaxWidth,
          'none',
          `${testCase.name}: positions view uses full width`
        );
        assert.ok(
          metrics.navHeight <= 44,
          `${testCase.name}: navigation fits short landscape height`
        );
        if (metrics.pageHeadingDisplay !== null) {
          assert.equal(
            metrics.pageHeadingDisplay,
            'none',
            `${testCase.name}: redundant heading is hidden`
          );
        }
      } else if (testCase.name.startsWith('portrait')) {
        assert.ok(
          Math.abs(metrics.shellHeight - testCase.height) <= 1,
          'portrait: shell fills viewport'
        );
        assert.equal(
          metrics.contentOverflowY,
          'auto',
          'portrait: content remains the scroll container'
        );
        assert.ok(
          metrics.navBottom <= testCase.height + 1,
          'portrait: navigation remains inside the viewport'
        );
        assert.ok(
          metrics.navBottom >= testCase.height - 120,
          'portrait: navigation remains near the bottom edge'
        );
      } else {
        assert.equal(
          metrics.mobileViewMaxWidth,
          'none',
          'desktop: positions HUD uses the available viewport'
        );
        assert.ok(
          metrics.mobileViewWidth >= testCase.width * 0.85,
          'desktop: positions HUD expands across the available content width'
        );
      }

      await page.screenshot({
        path: resolve(artifactDirectory, `${testCase.name}.png`),
        fullPage: false,
      });
      console.log(`PASS APP ${testCase.name}: ${JSON.stringify(metrics)}`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
