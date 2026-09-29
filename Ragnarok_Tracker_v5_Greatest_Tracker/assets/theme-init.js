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

  /*
   * Mobile Navigation Polish
   *
   * app.js intentionally tracks the visible section with IntersectionObserver.
   * During a programmatic smooth-scroll, however, each section passed on the
   * way can briefly become "active". This hotfix owns mobile nav taps in the
   * capture phase, visually locks the requested destination while scrolling,
   * then resumes deterministic scroll tracking after the destination settles.
   *
   * It is active only at <=720px, matching the existing mobile nav breakpoint.
   */
  const mobileNavStyle = document.createElement('style');
  mobileNavStyle.id = 'rtnw-mobile-nav-polish-style';
  mobileNavStyle.textContent = `
    @media (max-width: 720px) {
      .mobile-nav button {
        transition: background-color .14s ease, color .14s ease, box-shadow .14s ease;
      }

      body.rtnw-mobile-nav-locked .mobile-nav button.active {
        background: transparent;
        color: #dce8f1;
        box-shadow: none;
      }

      body.rtnw-mobile-nav-locked .mobile-nav button.active small {
        color: inherit;
      }

      body.rtnw-mobile-nav-locked .mobile-nav button.rtnw-nav-locked-active {
        background: linear-gradient(180deg,#f0d18f,#c89e4d);
        color: #1f3148;
        box-shadow: 0 5px 15px #0004;
      }

      body.rtnw-mobile-nav-locked .mobile-nav button.rtnw-nav-locked-active small {
        color: #1f3148;
      }

      .journal-fab {
        transition: opacity .16s ease, transform .16s ease;
      }

      body.rtnw-mobile-nav-locked .journal-fab {
        opacity: .18;
        transform: translateY(8px);
        pointer-events: none;
      }

      #daily-card,
      #weekly-card,
      #journal-card,
      #character-dock {
        scroll-margin-top: 86px;
      }
    }
  `;
  document.head.append(mobileNavStyle);

  function installMobileNavPolish() {
    const nav = document.querySelector('.mobile-nav');
    if (!nav) return;

    const MOBILE_QUERY = '(max-width: 720px)';
    const mobileQuery = window.matchMedia?.(MOBILE_QUERY);
    const sectionIds = ['daily-card', 'weekly-card', 'journal-card', 'character-dock'];
    let lockedTarget = '';
    let settleFrame = 0;
    let syncFrame = 0;
    let releaseToken = 0;

    const isMobile = () =>
      mobileQuery ? mobileQuery.matches : window.innerWidth <= 720;

    const buttons = () => [...nav.querySelectorAll('[data-mobile-target]')];

    const markDom = id => {
      if (!id) return;
      buttons().forEach(button => {
        button.classList.toggle('active', button.dataset.mobileTarget === id);
      });
    };

    const stickyOffset = () => {
      const quickbar = document.querySelector('.quickbar');
      const height = quickbar?.getBoundingClientRect().height || 0;
      // Existing quickbar uses top:8px. Keep a little breathing room below it.
      return Math.max(20, 8 + height + 12);
    };

    const viewportSection = () => {
      const sections = sectionIds
        .map(id => document.getElementById(id))
        .filter(Boolean);

      if (!sections.length) return '';

      // Use one stable reading line instead of intersection ratios. This makes
      // manual scrolling feel calmer around boundaries between short sections.
      const anchor = Math.min(
        Math.max(96, window.innerHeight * 0.22),
        190
      );

      const containing = sections.find(el => {
        const rect = el.getBoundingClientRect();
        return rect.top <= anchor && rect.bottom > anchor;
      });
      if (containing) return containing.id;

      let best = sections[0];
      let bestDistance = Infinity;
      sections.forEach(el => {
        const rect = el.getBoundingClientRect();
        const distance = Math.abs(rect.top - anchor);
        if (distance < bestDistance) {
          best = el;
          bestDistance = distance;
        }
      });
      return best?.id || '';
    };

    const syncFromViewport = () => {
      syncFrame = 0;
      if (!isMobile() || lockedTarget) return;
      const id = viewportSection();
      if (id) markDom(id);
    };

    const scheduleSync = () => {
      if (syncFrame) return;
      syncFrame = requestAnimationFrame(syncFromViewport);
    };

    const endLock = token => {
      if (token !== releaseToken) return;
      lockedTarget = '';
      document.body.classList.remove('rtnw-mobile-nav-locked');
      buttons().forEach(button => button.classList.remove('rtnw-nav-locked-active'));
      scheduleSync();
    };

    const watchForSettle = (targetId, token) => {
      cancelAnimationFrame(settleFrame);
      let lastY = window.scrollY;
      let stableFrames = 0;
      const started = performance.now();

      const step = () => {
        if (token !== releaseToken || lockedTarget !== targetId) return;

        const y = window.scrollY;
        if (Math.abs(y - lastY) < 0.5) stableFrames += 1;
        else stableFrames = 0;
        lastY = y;

        const elapsed = performance.now() - started;
        if ((elapsed > 220 && stableFrames >= 5) || elapsed > 1600) {
          // Let the browser deliver any final intersection callbacks while the
          // visual lock is still active, then hand control back to scroll sync.
          setTimeout(() => endLock(token), 80);
          return;
        }

        settleFrame = requestAnimationFrame(step);
      };

      settleFrame = requestAnimationFrame(step);
    };

    const navigate = id => {
      if (!isMobile()) return;

      const target = document.getElementById(id);
      if (!target) return;

      releaseToken += 1;
      const token = releaseToken;
      lockedTarget = id;

      document.body.classList.add('rtnw-mobile-nav-locked');
      buttons().forEach(button => {
        const selected = button.dataset.mobileTarget === id;
        button.classList.toggle('rtnw-nav-locked-active', selected);
        // Keep the semantic/current DOM state aligned with the requested tab.
        button.classList.toggle('active', selected);
      });

      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const top = Math.max(
        0,
        window.scrollY + target.getBoundingClientRect().top - stickyOffset()
      );

      window.scrollTo({
        top,
        behavior: reducedMotion ? 'auto' : 'smooth'
      });

      if (reducedMotion) {
        setTimeout(() => endLock(token), 40);
      } else {
        watchForSettle(id, token);
      }
    };

    // Capture-phase ownership prevents app.js's two existing mobile button
    // listeners from starting a second scroll and from immediately fighting
    // over the active highlight. "More" is untouched because it has no
    // data-mobile-target attribute.
    nav.addEventListener('click', event => {
      const button = event.target.closest?.('[data-mobile-target]');
      if (!button || !nav.contains(button) || !isMobile()) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      navigate(button.dataset.mobileTarget);
    }, true);

    window.addEventListener('scroll', scheduleSync, { passive: true });
    window.addEventListener('resize', scheduleSync, { passive: true });

    // If the user manually touches the page while a smooth navigation scroll
    // is running, stop visually locking the previous destination.
    document.addEventListener('touchstart', event => {
      if (!lockedTarget || event.target.closest?.('.mobile-nav')) return;
      releaseToken += 1;
      lockedTarget = '';
      document.body.classList.remove('rtnw-mobile-nav-locked');
      buttons().forEach(button => button.classList.remove('rtnw-nav-locked-active'));
      scheduleSync();
    }, { passive: true, capture: true });

    if (mobileQuery?.addEventListener) {
      mobileQuery.addEventListener('change', () => {
        if (!isMobile()) {
          releaseToken += 1;
          lockedTarget = '';
          document.body.classList.remove('rtnw-mobile-nav-locked');
          buttons().forEach(button => button.classList.remove('rtnw-nav-locked-active'));
        } else {
          scheduleSync();
        }
      });
    }

    scheduleSync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installMobileNavPolish, { once: true });
  } else {
    installMobileNavPolish();
  }
  /*
   * Vercel Analytics + Speed Insights
   *
   * Loads Vercel's first-party measurement scripts on the public tracker and
   * emits a small set of privacy-safe engagement events. No character names,
   * quest names, Journal text, notes, contacts, pairing codes, or tracker state
   * are included in custom event data.
   */
  function installVercelInsights() {
    window.va = window.va || function () {
      (window.vaq = window.vaq || []).push(arguments);
    };
    window.si = window.si || function () {
      (window.siq = window.siq || []).push(arguments);
    };

    const inject = (src, key) => {
      if (document.querySelector(`script[data-rtnw-insights="${key}"]`)) return;
      const script = document.createElement('script');
      script.defer = true;
      script.src = src;
      script.dataset.rtnwInsights = key;
      document.head.append(script);
    };

    inject('/_vercel/insights/script.js', 'analytics');
    inject('/_vercel/speed-insights/script.js', 'speed');

    const track = (name, data = {}) => {
      try {
        if (typeof window.va === 'function') {
          window.va('event', { name, data });
        }
      } catch (_) {}
    };

    // Track only successful server-side actions. We inspect only the action
    // category fields needed for aggregate analytics and never send form text.
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async function (input, init = {}) {
      let pendingEvent = null;

      try {
        const rawUrl = input instanceof Request ? input.url : String(input || '');
        const url = new URL(rawUrl, location.href);
        const method = String(
          init.method || (input instanceof Request ? input.method : 'GET')
        ).toUpperCase();

        if (url.origin === location.origin && method === 'POST') {
          if (url.pathname === '/api/feedback' && typeof init.body === 'string') {
            const body = JSON.parse(init.body);
            const type = ['bug', 'suggestion', 'general'].includes(body?.type)
              ? body.type
              : 'other';
            const area = [
              'dailies', 'weeklies', 'journal', 'characters',
              'layout', 'mobile', 'cloud', 'other'
            ].includes(body?.area) ? body.area : 'other';

            pendingEvent = {
              name: 'feedback_submitted',
              data: { type, area }
            };
          }

          if (url.pathname === '/api/sync' && typeof init.body === 'string') {
            const body = JSON.parse(init.body);
            if (body?.action === 'create') {
              pendingEvent = {
                name: 'cloud_sync_connected',
                data: { method: 'create' }
              };
            }
          }
        }
      } catch (_) {}

      const response = await nativeFetch(input, init);

      if (response?.ok && pendingEvent) {
        track(pendingEvent.name, pendingEvent.data);
      }

      return response;
    };

    const isIOS = () =>
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const questKind = element => {
      const row = element?.closest?.('.task-row');
      return row?.dataset?.kind === 'weekly' ? 'weekly' : 'daily';
    };

    const installEngagementEvents = () => {
      const actionState = new WeakMap();

      // Capture values before app.js handles a click. The bubble-phase handler
      // can then tell whether the action actually completed.
      document.addEventListener('click', event => {
        const target = event.target.closest?.('button, a');
        if (!target) return;

        if (target.id === 'journal-quick-add') {
          actionState.set(target, {
            kind: 'journal-quick',
            hadValue: !!document.getElementById('journal-quick-input')?.value.trim()
          });
        } else if (target.id === 'journal-quick-dialog-save') {
          actionState.set(target, {
            kind: 'journal-dialog-quick',
            hadValue: !!document.getElementById('journal-quick-dialog-input')?.value.trim()
          });
        } else if (target.id === 'journal-save') {
          actionState.set(target, {
            kind: 'journal-detailed',
            isNew: !document.getElementById('journal-id')?.value,
            hadValue: !!document.getElementById('journal-title')?.value.trim(),
            type: document.getElementById('journal-type')?.value || 'inbox'
          });
        } else if (target.id === 'character-save') {
          actionState.set(target, {
            kind: 'character',
            isNew: !document.getElementById('character-id')?.value,
            hadValue: !!document.getElementById('character-name')?.value.trim(),
            copiedSetup: !!document.getElementById('character-copy-quests')?.checked
          });
        } else if (target.classList?.contains('task-name-hit')) {
          actionState.set(target, {
            kind: 'quest-name',
            completing: String(target.getAttribute('aria-label') || '').startsWith('Complete'),
            questKind: questKind(target)
          });
        } else if (
          target.classList?.contains('counter-btn') &&
          String(target.textContent || '').includes('＋')
        ) {
          const row = target.closest('.task-row');
          const text = row?.querySelector('.counter-value')?.textContent || '';
          const match = text.match(/(\d+)\s*\/\s*(\d+)/);
          if (match) {
            const current = Number(match[1]);
            const total = Number(match[2]);
            if (current + 1 >= total) {
              setTimeout(() => {
                track('quest_completed', {
                  kind: row?.dataset?.kind === 'weekly' ? 'weekly' : 'daily'
                });
              }, 0);
            }
          }
        } else if (target.id === 'task-save') {
          const id = document.getElementById('task-id')?.value || '';
          const current = Number(document.getElementById('task-progress')?.value || 0);
          const total = Math.max(
            1,
            Number(document.getElementById('task-target')?.value || 1)
          );
          const selector = id && window.CSS?.escape
            ? `[data-task-id="${CSS.escape(id)}"] .task-check input`
            : '';
          const wasDone = selector
            ? !!document.querySelector(selector)?.checked
            : false;

          actionState.set(target, {
            kind: 'task-save',
            completing: !!id && !wasDone && current >= total,
            questKind: document.getElementById('task-kind')?.value === 'weekly'
              ? 'weekly'
              : 'daily'
          });
        }
      }, true);

      document.addEventListener('click', event => {
        const target = event.target.closest?.('button, a');
        if (!target) return;

        if ([
          'open-support',
          'support-card-qr',
          'footer-support',
          'settings-support'
        ].includes(target.id)) {
          track('support_clicked');
        }

        if (
          target.tagName === 'A' &&
          /buymeacoffee\.com\/FatherJunJun/i.test(target.href || '')
        ) {
          track('support_outbound_clicked');
        }

        if (['share-tracker', 'settings-share'].includes(target.id)) {
          track('tracker_share_clicked');
        }

        if (target.id === 'install-app') {
          track('install_app_clicked', {
            method: isIOS() ? 'ios_instructions' : 'browser'
          });
        }

        const state = actionState.get(target);
        if (!state) return;
        actionState.delete(target);

        if (state.kind === 'journal-quick') {
          if (
            state.hadValue &&
            !document.getElementById('journal-quick-input')?.value
          ) {
            track('journal_item_added', {
              method: 'quick',
              type: 'inbox'
            });
          }
        }

        if (state.kind === 'journal-dialog-quick') {
          setTimeout(() => {
            const dialog = document.getElementById('journal-quick-dialog');
            if (state.hadValue && dialog && !dialog.open) {
              track('journal_item_added', {
                method: 'quick_dialog',
                type: 'inbox'
              });
            }
          }, 0);
        }

        if (state.kind === 'journal-detailed') {
          setTimeout(() => {
            const dialog = document.getElementById('journal-dialog');
            if (state.isNew && state.hadValue && dialog && !dialog.open) {
              const safeType = [
                'inbox', 'need', 'goal', 'trade', 'dream'
              ].includes(state.type) ? state.type : 'inbox';

              track('journal_item_added', {
                method: 'detailed',
                type: safeType
              });
            }
          }, 0);
        }

        if (state.kind === 'character') {
          setTimeout(() => {
            const dialog = document.getElementById('character-dialog');
            if (state.isNew && state.hadValue && dialog && !dialog.open) {
              track('character_created', {
                copiedSetup: !!state.copiedSetup
              });
            }
          }, 0);
        }

        if (state.kind === 'quest-name' && state.completing) {
          track('quest_completed', {
            kind: state.questKind
          });
        }

        if (state.kind === 'task-save' && state.completing) {
          setTimeout(() => {
            const dialog = document.getElementById('task-dialog');
            if (dialog && !dialog.open) {
              track('quest_completed', {
                kind: state.questKind
              });
            }
          }, 0);
        }
      });

      // Checkbox completion is the most common quest-completion action.
      document.addEventListener('change', event => {
        const input = event.target;
        if (
          input?.matches?.('.task-check input[type="checkbox"]') &&
          input.checked
        ) {
          track('quest_completed', {
            kind: questKind(input)
          });
        }
      });

      // Keyboard quick-capture support.
      document.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;

        if (event.target?.id === 'journal-quick-input') {
          const hadValue = !!event.target.value.trim();
          setTimeout(() => {
            if (hadValue && !event.target.value) {
              track('journal_item_added', {
                method: 'quick',
                type: 'inbox'
              });
            }
          }, 0);
        }

        if (event.target?.id === 'journal-quick-dialog-input') {
          const hadValue = !!event.target.value.trim();
          setTimeout(() => {
            const dialog = document.getElementById('journal-quick-dialog');
            if (hadValue && dialog && !dialog.open) {
              track('journal_item_added', {
                method: 'quick_dialog',
                type: 'inbox'
              });
            }
          }, 0);
        }
      });

      const joinDialog = document.getElementById('cloud-join-dialog');
      joinDialog?.addEventListener('close', () => {
        if (joinDialog.returnValue === 'connected') {
          track('cloud_sync_connected', {
            method: 'join'
          });
        }
      });

      window.addEventListener('appinstalled', () => {
        track('app_installed');
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener(
        'DOMContentLoaded',
        installEngagementEvents,
        { once: true }
      );
    } else {
      installEngagementEvents();
    }
  }

  installVercelInsights();

})();
