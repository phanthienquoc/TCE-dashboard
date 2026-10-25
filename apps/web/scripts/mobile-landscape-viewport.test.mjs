import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer';

const layoutUrl = new URL('../app/layout.tsx', import.meta.url);
const layoutSource = readFileSync(layoutUrl, 'utf8');
const stylesheetPaths = [...layoutSource.matchAll(/^import\s+['"]([^'"]+\.css)['"];?\s*$/gm)].map(
  match => match[1]
);
assert.ok(
  stylesheetPaths.includes('./mobile-command-center.css'),
  'layout must import the mobile command-center stylesheet'
);
const css = stylesheetPaths
  .map(path =>
    readFileSync(new URL(path, layoutUrl), 'utf8').replace(/^[ \t]*@import\s+[^;]+;[ \t]*$/gm, '')
  )
  .join('\n');

const artifactDirectory = resolve('artifacts/mobile-landscape');
mkdirSync(artifactDirectory, { recursive: true });

const navigation = Array.from(
  { length: 7 },
  (_, index) =>
    `<button class="tce-bottom-tab"><span class="tce-bottom-tab-icon">${index + 1}</span><span>Tab ${index + 1}</span></button>`
).join('');
const cards = Array.from(
  { length: 8 },
  (_, index) =>
    `<section class="tce-section"><div class="tce-section-title"><h2>Positions ${index + 1}</h2></div><article class="tce-position-card"><div class="tce-card-top"><strong>FPT</strong><span>HOLDING</span></div><div class="tce-price-line"><strong>128.50</strong><span>+1.2%</span></div><div class="tce-pool-grid">${'<div><span>Shares</span><b>100</b></div>'.repeat(6)}</div></article></section>`
).join('');
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TCE mobile landscape CSS contract fixture</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    ${css}
  </style>
</head>
<body>
  <div class="app-shell">
    <div class="tce-breadcrumbs">Breadcrumbs</div>
    <div class="dashboard-layout">
      <main class="app-content app-container">
        <h1 class="page-heading">Dashboard</h1>
        <div class="tce-mobile-view">
          <header class="tce-mobile-header">
            <div class="tce-header-brand"><span class="tce-brand-mark">T</span><div><strong>TCE Dashboard</strong><span>Market command center</span></div></div>
            <span class="tce-live-pill">PAPER</span>
          </header>
          <div class="tce-hero-card"><div><span class="tce-label">Portfolio value</span><strong>125,000,000 VND</strong></div></div>
          <div class="tce-stat-grid">${"<div class='tce-stat'><span>Metric</span><strong>125.0M</strong></div>".repeat(6)}</div>
          ${cards}
        </div>
      </main>
      <nav class="tce-bottom-tabs" aria-label="Primary navigation">
        <div class="tce-bottom-tabs-inner">${navigation}</div>
      </nav>
    </div>
    <div class="tce-filter-sheet-backdrop" style="display:none; position:fixed; inset:0; align-items:center; justify-content:center;">
      <section class="tce-filter-sheet">
        <header class="tce-filter-sheet-header"><strong>Dividend filters</strong><button class="tce-filter-sheet-close">Close</button></header>
        <div class="tce-filter-sheet-body">${"<label class='tce-filter-control'><span>Filter</span><select><option>All</option></select></label>".repeat(5)}</div>
        <footer class="tce-filter-sheet-footer"><button>Reset</button><button>Apply</button></footer>
      </section>
    </div>
  </div>
</body>
</html>`;

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

  const cases = [
    { name: 'portrait-390x844', width: 390, height: 844, landscape: false },
    { name: 'landscape-844x430', width: 844, height: 430, landscape: true },
    { name: 'short-landscape-844x390', width: 844, height: 390, landscape: true },
    { name: 'desktop-1280x800', width: 1280, height: 800, landscape: false },
  ];

  for (const testCase of cases) {
    await page.setViewport({
      width: testCase.width,
      height: testCase.height,
      deviceScaleFactor: 1,
      isMobile: testCase.width <= 950,
      hasTouch: testCase.width <= 950,
    });
    await page.setContent(html, { waitUntil: 'load' });

    const metrics = await page.evaluate(() => {
      const nav = document.querySelector('.tce-bottom-tabs');
      const navInner = document.querySelector('.tce-bottom-tabs-inner');
      const shell = document.querySelector('.app-shell');
      const content = document.querySelector('.dashboard-layout > .app-content');
      const mobileView = document.querySelector('.tce-mobile-view');
      const heading = document.querySelector('.page-heading');
      const style = element => getComputedStyle(element);
      return {
        width: window.innerWidth,
        height: window.innerHeight,
        landscapeMediaMatches: matchMedia(
          'screen and (max-width: 950px) and (max-height: 500px) and (orientation: landscape)'
        ).matches,
        navPosition: style(nav).position,
        navHeight: Number.parseFloat(style(nav).height),
        navTop: nav.getBoundingClientRect().top,
        navBottom: nav.getBoundingClientRect().bottom,
        navGridColumns: style(navInner).gridTemplateColumns.trim().split(' ').length,
        navItemCount: navInner.querySelectorAll('.tce-bottom-tab').length,
        navItemsWithinNav: [...navInner.querySelectorAll('.tce-bottom-tab')].every(item => {
          const itemRect = item.getBoundingClientRect();
          const navRect = nav.getBoundingClientRect();
          return itemRect.top >= navRect.top - 1 && itemRect.bottom <= navRect.bottom + 1;
        }),
        headerTitleColor: style(document.querySelector('.tce-mobile-header strong')).color,
        shellHeight: Number.parseFloat(style(shell).height),
        contentOverflowY: style(content).overflowY,
        mobileViewMaxWidth: style(mobileView).maxWidth,
        pageHeadingDisplay: style(heading).display,
        documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      };
    });

    assert.equal(
      metrics.landscapeMediaMatches,
      testCase.landscape,
      `${testCase.name}: landscape media query`
    );
    assert.ok(
      metrics.documentWidth <= testCase.width + 1,
      `${testCase.name}: horizontal overflow (${metrics.documentWidth}px)`
    );

    assert.equal(metrics.navGridColumns, 7, `${testCase.name}: seven navigation columns`);
    assert.equal(metrics.navItemCount, 7, `${testCase.name}: all seven navigation items are rendered`);
    assert.equal(metrics.navItemsWithinNav, true, `${testCase.name}: all navigation items fit inside the dock`);

    if (testCase.landscape) {
      assert.equal(metrics.headerTitleColor, 'rgb(242, 247, 248)', `${testCase.name}: landscape header text has the intended high-contrast color`);
      assert.equal(metrics.navPosition, 'fixed', `${testCase.name}: compact top navigation`);
      assert.ok(
        Math.abs(metrics.navTop) <= 1,
        `${testCase.name}: navigation starts at viewport top`
      );
      assert.ok(
        Math.abs(metrics.shellHeight - testCase.height) <= 1,
        `${testCase.name}: shell fills viewport`
      );
      assert.equal(
        metrics.contentOverflowY,
        'auto',
        `${testCase.name}: workspace scrolls vertically`
      );
      assert.equal(
        metrics.mobileViewMaxWidth,
        'none',
        `${testCase.name}: landscape workspace uses full width`
      );
      assert.equal(
        metrics.pageHeadingDisplay,
        'none',
        `${testCase.name}: hide redundant page heading`
      );
      assert.ok(
        metrics.navHeight <= 44,
        `${testCase.name}: navigation fits short landscape height`
      );

      const filter = await page.evaluate(() => {
        const backdrop = document.querySelector('.tce-filter-sheet-backdrop');
        const sheet = document.querySelector('.tce-filter-sheet');
        backdrop.style.display = 'flex';
        const rect = sheet.getBoundingClientRect();
        backdrop.style.display = 'none';
        return { width: rect.width, height: rect.height };
      });
      assert.ok(
        filter.width <= testCase.width - 18 + 1,
        `${testCase.name}: filter width stays inside viewport`
      );
      assert.ok(
        filter.height <= Math.min(330, testCase.height - 12) + 1,
        `${testCase.name}: filter fits short viewport`
      );
    } else if (testCase.name.startsWith('portrait')) {
      assert.ok(
        Math.abs(metrics.shellHeight - testCase.height) <= 1,
        'portrait: shell fills viewport'
      );
      assert.equal(
        metrics.contentOverflowY,
        'auto',
        'portrait: workspace remains the scroll container'
      );
      assert.equal(
        metrics.pageHeadingDisplay,
        'none',
        'portrait: retain compact mobile heading behavior'
      );
      assert.ok(
        metrics.navBottom <= testCase.height + 1,
        'portrait: navigation remains within the viewport'
      );
      assert.ok(
        metrics.navBottom >= testCase.height - 120,
        'portrait: navigation remains near the bottom edge'
      );
    } else {
      assert.equal(
        metrics.mobileViewMaxWidth,
        '480px',
        'desktop: preserve centered mobile view width'
      );
    }

    await page.screenshot({
      path: resolve(artifactDirectory, `${testCase.name}.png`),
      fullPage: true,
    });
    console.log(`PASS ${testCase.name}: ${JSON.stringify(metrics)}`);
  }
} finally {
  await browser.close();
}
