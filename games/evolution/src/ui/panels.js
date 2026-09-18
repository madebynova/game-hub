/* The three panels: Journal, Creature and Menu.

   All three share one modal shell so only one can ever be open, and opening
   one pauses the world. The Creature panel animates a live portrait using the
   same draw code as the world, so the player can look closely at what their
   adaptations have actually done to them. */

(function (EVO) {
  'use strict';

  var U = EVO.U;
  var A = EVO.Adapt;
  var D = EVO.Discovery;

  function $(id) { return document.getElementById(id); }

  var modal, box, titleEl, bodyEl, closeBtn;
  var portraitTimer = null;

  var P = {
    open: null,
    onChange: null,
    onNewGame: null,
    onSaveNow: null,
    onToggleAudio: null,

    init: function () {
      modal = $('modal');
      box = $('modal-box');
      titleEl = $('modal-title');
      bodyEl = $('modal-body');
      closeBtn = $('modal-close');

      closeBtn.addEventListener('click', function () { P.close(); });
      modal.addEventListener('mousedown', function (e) {
        if (e.target === modal) P.close();
      });
    },

    toggle: function (which) {
      if (P.open === which) P.close();
      else P.show(which);
    },

    show: function (which) {
      P.open = which;
      modal.classList.remove('hidden');
      if (which === 'journal') P.renderJournal();
      else if (which === 'creature') P.renderCreature();
      else P.renderMenu();
      if (P.onChange) P.onChange(true);
    },

    close: function () {
      if (!P.open) return;
      P.open = null;
      modal.classList.add('hidden');
      if (portraitTimer) {
        cancelAnimationFrame(portraitTimer);
        portraitTimer = null;
      }
      if (P.onChange) P.onChange(false);
    },

    /* --- journal ---------------------------------------------------------- */

    renderJournal: function () {
      titleEl.textContent = 'Discovery Journal';
      var html = '<div class="j-progress"><b>' + D.count() + '</b> of ' + D.total() +
                 ' discovered in the Cradle</div>';

      D.CATEGORIES.forEach(function (cat) {
        var list = D.byCategory(cat.id);
        if (!list.length) return;
        var foundCount = list.filter(function (e) { return e.found; }).length;
        html += '<div class="j-cat">' + cat.label + ' &middot; ' + foundCount + '/' + list.length + '</div>';
        html += '<div class="j-grid">';
        list.forEach(function (e) {
          if (e.found) {
            html += '<div class="j-entry"><div class="j-name">' + esc(e.entry.name) +
                    '</div><div class="j-desc">' + esc(e.entry.desc) + '</div></div>';
          } else {
            html += '<div class="j-entry undiscovered"><div class="j-name">Undiscovered</div>' +
                    '<div class="j-desc">' + esc(e.entry.teaser) + '</div></div>';
          }
        });
        html += '</div>';
      });

      bodyEl.innerHTML = html;
      bodyEl.scrollTop = 0;
    },

    /* --- creature ---------------------------------------------------------- */

    renderCreature: function () {
      titleEl.textContent = 'Your Creature';

      var player = EVO.Player;
      var html = '' +
        '<div class="c-hero">' +
          '<canvas id="c-portrait" width="264" height="264"></canvas>' +
          '<div class="c-hero-text">' +
            '<h3>' + esc(A.stageName()) + '</h3>' +
            '<p>Small, soft and curious. What it becomes is decided by what you do with it.</p>' +
            '<div class="c-stats">' +
              '<div class="c-stat"><b>' + A.count() + '/3</b>adaptations</div>' +
              '<div class="c-stat"><b>' + D.count() + '</b>discoveries</div>' +
              '<div class="c-stat"><b>' + Math.round(player.distance / 100) + 'm</b>travelled</div>' +
              '<div class="c-stat"><b>' + U.formatTime(player.waterTime) + '</b>in water</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      A.order.forEach(function (id) {
        var def = A.DEFS[id];
        var has = A.has(id);
        html += '<div class="a-card ' + id + (has ? ' unlocked' : '') + '">' +
          '<div class="a-top">' +
            '<span class="a-track">' + esc(def.track) + '</span>' +
            '<span class="a-title">' + esc(def.name) + '</span>' +
            '<span class="a-state">' + (has ? 'Developed' : Math.floor(A.progress[id]) + ' / ' + A.GOAL) + '</span>' +
          '</div>' +
          '<div class="a-body">' + esc(def.blurb) + '</div>' +
          '<ul class="a-effects">' +
            def.effects.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') +
          '</ul>' +
          (has ? '' : '<div class="a-meter"><i style="width:' + (A.ratio(id) * 100) + '%"></i></div>' +
                      '<div class="a-body" style="opacity:.75;margin-top:7px">Develops through: ' +
                      esc(def.sources) + '</div>') +
        '</div>';
      });

      bodyEl.innerHTML = html;
      bodyEl.scrollTop = 0;
      P.animatePortrait();
    },

    animatePortrait: function () {
      var cv = $('c-portrait');
      if (!cv) return;
      var ctx = cv.getContext('2d');
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = 264 * dpr;
      cv.height = 264 * dpr;

      var state = {
        facing: -0.35,
        speedNorm: 0,
        walkPhase: 0,
        hop: 0,
        squashX: 1, squashY: 1,
        swimming: false,
        inWater: false,
        adapt: A.unlocked,
        blink: 0,
        harvest: 0,
        flash: 0
      };
      var blinkAt = 1.6;
      var start = performance.now();

      function frame(now) {
        var t = (now - start) / 1000;
        state.walkPhase = t * 1.2;
        var breath = Math.sin(t * 1.9) * 0.03;
        state.squashX = 1 + breath * 0.6;
        state.squashY = 1 - breath;
        state.facing = -0.35 + Math.sin(t * 0.5) * 0.22;
        if (t > blinkAt) { state.blink = 1; blinkAt = t + U.range(Math.random, 2, 5); }
        state.blink = Math.max(0, state.blink - 0.05);

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, 264, 264);
        ctx.save();
        ctx.translate(132, 142);
        ctx.scale(3.1, 3.1);
        EVO.Creature.draw(ctx, state, t);
        ctx.restore();

        portraitTimer = requestAnimationFrame(frame);
      }
      if (portraitTimer) cancelAnimationFrame(portraitTimer);
      portraitTimer = requestAnimationFrame(frame);
    },

    /* --- menu -------------------------------------------------------------- */

    renderMenu: function () {
      titleEl.textContent = 'Menu';
      var S = EVO.Save;
      var saved = S.lastSavedAt
        ? new Date(S.lastSavedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
        : 'not yet this session';

      bodyEl.innerHTML = '' +
        '<div class="m-row">' +
          '<div class="m-label">Save progress' +
            '<span class="m-sub">' + (S.available
              ? 'Saves automatically. Last save: ' + saved
              : 'Storage is blocked in this browser, so progress cannot be kept.') + '</span>' +
          '</div>' +
          '<button class="btn" id="m-save"' + (S.available ? '' : ' disabled') + '>Save now</button>' +
        '</div>' +
        '<div class="m-row">' +
          '<div class="m-label">Sound' +
            '<span class="m-sub">Ambience and effects.</span>' +
          '</div>' +
          '<button class="btn" id="m-audio">' + (EVO.Audio.muted ? 'Off' : 'On') + '</button>' +
        '</div>' +
        '<div class="m-row">' +
          '<div class="m-label">Start over' +
            '<span class="m-sub">Discards this creature and everything it has found.</span>' +
          '</div>' +
          '<button class="btn danger" id="m-new">New creature</button>' +
        '</div>' +
        '<div class="m-row" style="display:block">' +
          '<div class="m-label" style="margin-bottom:6px">Controls</div>' +
          '<div class="m-help">' +
            '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows &mdash; move<br>' +
            '<kbd>E</kbd> &mdash; interact (hold to harvest)<br>' +
            '<kbd>Space</kbd> &mdash; leap, once Springcoil is developed<br>' +
            '<kbd>J</kbd> &mdash; journal &nbsp; <kbd>C</kbd> &mdash; creature &nbsp; <kbd>Esc</kbd> &mdash; this menu' +
          '</div>' +
        '</div>';

      var saveBtn = $('m-save');
      if (saveBtn) {
        saveBtn.addEventListener('click', function () {
          if (P.onSaveNow) P.onSaveNow();
          P.renderMenu();
        });
      }
      $('m-audio').addEventListener('click', function () {
        if (P.onToggleAudio) P.onToggleAudio();
        P.renderMenu();
      });
      $('m-new').addEventListener('click', function () {
        var btn = $('m-new');
        if (btn.dataset.confirm === '1') {
          if (P.onNewGame) P.onNewGame();
        } else {
          btn.dataset.confirm = '1';
          btn.textContent = 'Really start over?';
        }
      });
    }
  };

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  EVO.Panels = P;
})(window.EVO);
