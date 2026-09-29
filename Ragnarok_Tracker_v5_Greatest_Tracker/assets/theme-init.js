(() => {
  'use strict';

  // Existing early theme initialization.
  try {
    const saved = JSON.parse(localStorage.getItem('rtnw-tracker-v5') || 'null');
    const pref = saved?.settings?.theme || 'system';
    const wantsDark = pref === 'dark' || (pref === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = wantsDark ? 'dark' : 'light';
  } catch (_) {
    document.documentElement.dataset.theme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /*
   * Fluid Daily Grid hotfix
   *
   * The normal two-column Daily grid is row-based. If General is tall while
   * Guild is collapsed, the next row has to wait for General, leaving a large
   * blank area under Guild.
   *
   * This enhancement keeps the existing category order/left-right assignment,
   * but wraps the cards into two independent vertical columns on wide screens.
   * It intentionally disables itself in Organize mode and below 920px.
   */
  const FLOW_COLUMN_CLASS = 'rtnw-fluid-column';
  const FLOW_READY_CLASS = 'rtnw-fluid-ready';
  const desktopFlow = window.matchMedia?.('(min-width: 920px)');

  const style = document.createElement('style');
  style.id = 'rtnw-fluid-daily-grid-style';
  style.textContent = `
    @media (min-width: 920px) {
      body.desktop-efficient:not(.organize-mode)
      #daily-groups.${FLOW_READY_CLASS} > .${FLOW_COLUMN_CLASS} {
        display: grid;
        align-content: start;
        gap: 9px;
        min-width: 0;
      }

      body.desktop-efficient:not(.organize-mode)
      #daily-groups.${FLOW_READY_CLASS} > .${FLOW_COLUMN_CLASS} > .category-block {
        margin: 0;
        min-width: 0;
      }
    }
  `;
  document.head.append(style);

  function installFluidDailyGrid() {
    let arranging = false;
    let frame = 0;

    const schedule = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };

    const directColumns = root =>
      [...root.children].filter(el => el.classList?.contains(FLOW_COLUMN_CLASS));

    const restoreNormalGrid = root => {
      const columns = directColumns(root);
      if (!columns.length) {
        root.classList.remove(FLOW_READY_CLASS);
        return;
      }

      const cards = columns
        .flatMap(column => [...column.children])
        .filter(el => el.classList?.contains('category-block'))
        .sort((a, b) => Number(a.dataset.flowIndex || 0) - Number(b.dataset.flowIndex || 0));

      arranging = true;
      columns.forEach(column => column.remove());
      cards.forEach(card => {
        delete card.dataset.flowIndex;
        root.append(card);
      });
      root.classList.remove(FLOW_READY_CLASS);
      arranging = false;
    };

    function apply() {
      frame = 0;
      if (arranging) return;

      const root = document.getElementById('daily-groups');
      if (!root) return;

      const enabled =
        !!desktopFlow?.matches &&
        document.body.classList.contains('desktop-efficient') &&
        !document.body.classList.contains('organize-mode');

      if (!enabled) {
        restoreNormalGrid(root);
        return;
      }

      // If the app has already been arranged, leave the stable columns alone.
      const existingColumns = directColumns(root);
      if (existingColumns.length) {
        root.classList.add(FLOW_READY_CLASS);
        return;
      }

      // app.js renders category cards directly into #daily-groups. Re-wrap them
      // after every render so each desktop column can stack independently.
      const cards = [...root.children].filter(el => el.classList?.contains('category-block'));
      if (!cards.length) {
        root.classList.remove(FLOW_READY_CLASS);
        return;
      }

      arranging = true;

      const left = document.createElement('div');
      const right = document.createElement('div');
      left.className = FLOW_COLUMN_CLASS;
      right.className = FLOW_COLUMN_CLASS;
      left.dataset.flowColumn = '1';
      right.dataset.flowColumn = '2';

      cards.forEach((card, index) => {
        card.dataset.flowIndex = String(index);
        (index % 2 === 0 ? left : right).append(card);
      });

      // Keep the same left/right placement users already recognize from the
      // row grid, while allowing each side to collapse upward independently.
      if (left.childElementCount) root.append(left);
      if (right.childElementCount) root.append(right);
      root.classList.add(FLOW_READY_CLASS);

      arranging = false;
    }

    const start = () => {
      const root = document.getElementById('daily-groups');
      if (!root) {
        requestAnimationFrame(start);
        return;
      }

      new MutationObserver(() => {
        if (!arranging) schedule();
      }).observe(root, { childList: true });

      new MutationObserver(schedule).observe(document.body, {
        attributes: true,
        attributeFilter: ['class']
      });

      if (desktopFlow?.addEventListener) desktopFlow.addEventListener('change', schedule);
      else desktopFlow?.addListener?.(schedule);

      schedule();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  }

  installFluidDailyGrid();
})();
