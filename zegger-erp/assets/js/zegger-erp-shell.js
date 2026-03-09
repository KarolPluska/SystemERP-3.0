(function () {
  'use strict';

  var doc = document;
  var root = doc.getElementById('zegger-erp-app');
  var boot = window.ZEGGER_ERP_BOOT || null;
  if (!root || !boot || !boot.rest || !boot.routes) { return; }
  root.setAttribute('data-shell-js', 'loaded');

  var MOD_FALLBACK = ['start', 'offers', 'company-users', 'product-library', 'messenger', 'notifications'];
  var MOD_STORAGE = 'zegger_erp_mod_v3';
  var mods = uniqMods(boot.modules);
  var modSet = asSet(mods);

  var state = {
    auth: false,
    account: null,
    actor: null,
    company: null,
    authMode: 'login',
    activeMod: pickInitialMod(),
    mounted: false,
    listeners: false,
    offerFrame: null,
    offerSeq: 0,
    offerDirty: false,
    msgDirty: false,
    exportBusy: false,
    flash: '',
    joinCode: '',
    loading: { start: false, users: false, products: false, messenger: false, notifications: false },
    loadedAt: { start: 0, users: 0, products: 0, messenger: 0, notifications: 0 },
    cache: { offers: [], profile: null, users: null, codes: [], sheets: {}, sheetsMeta: null, messages: [], notifications: [] }
  };

  bindListeners();
  refreshSession(false);

  function uniqMods(input) {
    var out = [];
    var seen = {};
    var src = Array.isArray(input) ? MOD_FALLBACK.concat(input) : MOD_FALLBACK.slice();
    src.forEach(function (m) {
      var key = String(m || '').toLowerCase().trim();
      if (!key || seen[key]) { return; }
      if (MOD_FALLBACK.indexOf(key) < 0) { return; }
      seen[key] = true;
      out.push(key);
    });
    return out.length ? out : MOD_FALLBACK.slice();
  }

  function asSet(list) {
    var out = {};
    (list || []).forEach(function (k) { out[k] = true; });
    return out;
  }

  function normMod(v) {
    var key = String(v || '').toLowerCase().trim();
    return modSet[key] ? key : 'start';
  }

  function pickInitialMod() {
    var routed = normMod(boot.initialModule);
    if (routed !== 'start') { return routed; }
    return normMod(readLS(MOD_STORAGE));
  }

  function readLS(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function writeLS(k, v) { try { if (!v) window.localStorage.removeItem(k); else window.localStorage.setItem(k, String(v)); } catch (e) {} }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function dt(v) {
    if (!v) { return '-'; }
    var d = new Date(String(v).replace(' ', 'T'));
    return isNaN(d.getTime()) ? String(v) : d.toLocaleString('pl-PL');
  }

  function mins(sec) {
    var n = Number(sec || 0);
    if (!isFinite(n) || n < 0) { n = 0; }
    return Math.round(n / 60) + ' min';
  }

  function isFresh(k, ms) {
    var ts = Number(state.loadedAt[k] || 0);
    return !!ts && ((Date.now() - ts) < ms);
  }

  function apiUrl(nsPath, query) {
    var url = new URL(window.location.origin + '/');
    url.searchParams.set('rest_route', String(nsPath || ''));
    if (query && typeof query === 'object') {
      Object.keys(query).forEach(function (k) {
        var v = query[k];
        if (!k || v === null || v === undefined || v === '') { return; }
        url.searchParams.set(k, String(v));
      });
    }
    return url.toString();
  }

  function nsJoin(ns, p) {
    return String(ns || '').replace(/\/+$/g, '') + '/' + String(p || '').replace(/^\/+/, '');
  }

  async function req(nsPath, opts) {
    opts = opts || {};
    var headers = Object.assign({ 'Accept': 'application/json' }, opts.headers || {});
    if (window.wpApiSettings && window.wpApiSettings.nonce) { headers['X-WP-Nonce'] = String(window.wpApiSettings.nonce); }

    var cfg = { method: opts.method || 'GET', credentials: 'same-origin', cache: 'no-store', headers: headers };
    if (opts.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      cfg.body = JSON.stringify(opts.json);
    }

    var res = await fetch(apiUrl(nsPath, opts.query), cfg);
    var data = null;
    try { data = await res.json(); } catch (e) { data = null; }

    if (!res.ok || (data && data.ok === false)) {
      var msg = (data && data.message) ? String(data.message) : ('HTTP ' + res.status);
      var err = new Error(msg);
      err.status = res.status;
      err.payload = data;
      throw err;
    }
    return data || {};
  }

  function reqErp(path, opts) { return req(nsJoin(boot.rest.erpNs, path), opts); }
  function reqLegacy(path, opts) { return req(nsJoin(boot.rest.legacyNs, path), opts); }

  function hasUnsaved() { return !!(state.offerDirty || state.msgDirty); }

  function modLabel(m) {
    if (m === 'start') return 'Start';
    if (m === 'offers') return 'Oferty';
    if (m === 'company-users') return 'Uzytkownicy';
    if (m === 'product-library') return 'Biblioteka';
    if (m === 'messenger') return 'Messenger';
    if (m === 'notifications') return 'Powiadomienia';
    return m;
  }

  function modTitle(m) {
    if (m === 'offers') return 'Panel ofert';
    if (m === 'company-users') return 'Uzytkownicy firmy';
    if (m === 'product-library') return 'Biblioteka produktow';
    if (m === 'messenger') return 'Messenger zespolu';
    if (m === 'notifications') return 'Powiadomienia';
    return 'Start';
  }

  function authTitle() {
    if (state.authMode === 'register-company') return 'Nowa firma';
    if (state.authMode === 'join-company') return 'Dolacz do firmy';
    return 'Logowanie';
  }

  function authNote() {
    if (state.authMode === 'register-company') return 'Tworzysz firme i konto wlasciciela.';
    if (state.authMode === 'join-company') return 'Dolacz przez kod zaproszenia.';
    return 'Sesja dziala po cookie same-origin.';
  }

  function authFields() {
    if (state.authMode === 'register-company') {
      return '' +
        '<div class="zegger-erp__field"><label>Nazwa firmy</label><input class="zegger-erp__input" name="company_name" required></div>' +
        '<div class="zegger-erp__field-grid">' +
          '<div class="zegger-erp__field"><label>Login admina</label><input class="zegger-erp__input" name="admin_login" required></div>' +
          '<div class="zegger-erp__field"><label>Haslo</label><input class="zegger-erp__input" name="password" type="password" required></div>' +
        '</div>' +
        '<div class="zegger-erp__field-grid">' +
          '<div class="zegger-erp__field"><label>Imie i nazwisko</label><input class="zegger-erp__input" name="admin_name"></div>' +
          '<div class="zegger-erp__field"><label>Email</label><input class="zegger-erp__input" name="admin_email" type="email"></div>' +
        '</div>';
    }
    if (state.authMode === 'join-company') {
      return '' +
        '<div class="zegger-erp__field"><label>Kod dolaczenia</label><input class="zegger-erp__input" name="join_code" required></div>' +
        '<div class="zegger-erp__field-grid">' +
          '<div class="zegger-erp__field"><label>Login</label><input class="zegger-erp__input" name="login" required></div>' +
          '<div class="zegger-erp__field"><label>Haslo</label><input class="zegger-erp__input" name="password" type="password" required></div>' +
        '</div>' +
        '<div class="zegger-erp__field-grid">' +
          '<div class="zegger-erp__field"><label>Imie i nazwisko</label><input class="zegger-erp__input" name="full_name"></div>' +
          '<div class="zegger-erp__field"><label>Email</label><input class="zegger-erp__input" name="email" type="email"></div>' +
        '</div>';
    }
    return '' +
      '<div class="zegger-erp__field"><label>Login</label><input class="zegger-erp__input" name="login" required></div>' +
      '<div class="zegger-erp__field"><label>Haslo</label><input class="zegger-erp__input" name="password" type="password" required></div>';
  }

  function authSubmit() {
    if (state.authMode === 'register-company') return 'Utworz i zaloguj';
    if (state.authMode === 'join-company') return 'Dolacz i zaloguj';
    return 'Zaloguj';
  }

  function authBtn(mode, txt) {
    return '<button type="button" class="zegger-erp__mode-btn' + (state.authMode === mode ? ' is-active' : '') + '" data-auth-mode="' + mode + '">' + esc(txt) + '</button>';
  }

  function renderAuth(msg) {
    state.mounted = false;
    root.innerHTML = '' +
      '<div class="zegger-erp__auth-wrap"><div class="zegger-erp__auth-window">' +
        '<aside class="zegger-erp__auth-side">' +
          '<div class="zegger-erp__brand"><span class="zegger-erp__brand-dot"></span> ZEGGER ERP</div>' +
          '<h1 class="zegger-erp__auth-title">' + esc(authTitle()) + '</h1>' +
          '<p class="zegger-erp__auth-subtitle">' + esc(authNote()) + '</p>' +
          '<ul class="zegger-erp__auth-list"><li>Kalkulator pelni role launchera.</li><li>Panel ofert to legacy 1:1.</li></ul>' +
        '</aside>' +
        '<section class="zegger-erp__auth-main">' +
          '<div class="zegger-erp__mode-switch">' +
            authBtn('login', 'Logowanie') + authBtn('register-company', 'Nowa firma') + authBtn('join-company', 'Dolacz') +
          '</div>' +
          '<form id="zegger-erp-auth-form" class="zegger-erp__form" autocomplete="off">' +
            authFields() +
            '<button id="zegger-erp-auth-submit" class="zegger-erp__btn zegger-erp__btn--primary" type="submit">' + esc(authSubmit()) + '</button>' +
            '<div id="zegger-erp-auth-msg" class="zegger-erp__msg">' + esc(msg || '') + '</div>' +
          '</form>' +
        '</section>' +
      '</div></div>';
  }
  function shellMarkup() {
    var nav = mods.map(function (m) { return '<button type="button" class="zegger-erp__tab-btn" data-module="' + m + '">' + esc(modLabel(m)) + '</button>'; }).join('');
    var mob = mods.map(function (m) { return '<button type="button" class="zegger-erp__mobile-btn" data-module="' + m + '">' + esc(modLabel(m)) + '</button>'; }).join('');

    return '' +
      '<div class="zegger-erp__window">' +
        '<header class="zegger-erp__topbar">' +
          '<div class="zegger-erp__topbar-left"><div class="zegger-erp__brand"><span class="zegger-erp__brand-dot"></span> ' + esc((boot.ui && boot.ui.brand) ? boot.ui.brand : 'ZEGGER ERP') + '</div><span id="zegger-erp-account" class="zegger-erp__badge">...</span><span id="zegger-erp-unsaved" class="zegger-erp__badge">Brak zmian</span></div>' +
          '<div class="zegger-erp__topbar-right"><strong id="zegger-erp-title" class="zegger-erp__module-title">Start</strong><button class="zegger-erp__btn" type="button" data-action="logout">Wyloguj</button></div>' +
        '</header>' +
        '<nav class="zegger-erp__tabs">' + nav + '</nav>' +
        '<main class="zegger-erp__main">' +
          '<section class="zegger-erp__module" data-view="start">' +
            '<article class="zegger-erp__panel"><div class="zegger-erp__panel-head"><h2>Sesja i podsumowanie</h2><div class="zegger-erp__actions"><button class="zegger-erp__btn" type="button" data-action="start-refresh">Odswiez</button><button class="zegger-erp__btn" type="button" data-action="open-offers">Otworz oferty</button></div></div><div id="zegger-erp-start-msg" class="zegger-erp__note"></div><div class="zegger-erp__summary"><div class="zegger-erp__summary-item"><span>Konto</span><strong id="z-start-account">-</strong></div><div class="zegger-erp__summary-item"><span>Firma</span><strong id="z-start-company">-</strong></div><div class="zegger-erp__summary-item"><span>Oferty</span><strong id="z-start-offers">-</strong></div><div class="zegger-erp__summary-item"><span>Klienci</span><strong id="z-start-clients">-</strong></div><div class="zegger-erp__summary-item"><span>Czas panelu</span><strong id="z-start-time">-</strong></div><div class="zegger-erp__summary-item"><span>Status new</span><strong id="z-start-new">-</strong></div></div></article>' +
            '<article class="zegger-erp__panel"><h2>Ostatnie oferty</h2><div class="zegger-erp__table-wrap"><table class="zegger-erp__table"><thead><tr><th>ID</th><th>Tytul</th><th>Status</th><th>Aktualizacja</th></tr></thead><tbody id="z-start-offers-rows"><tr><td colspan="4" class="zegger-erp__muted">Ladowanie...</td></tr></tbody></table></div></article>' +
            '<article class="zegger-erp__panel"><h2>Ostatnie zdarzenia</h2><ul id="z-start-notifs" class="zegger-erp__simple-list"><li class="zegger-erp__muted">Ladowanie...</li></ul></article>' +
          '</section>' +
          '<section class="zegger-erp__module" data-view="offers"><article class="zegger-erp__panel zegger-erp__panel--iframe"><iframe id="zegger-erp-offer-iframe" class="zegger-erp__offer-iframe" title="Panel ofert legacy" loading="eager"></iframe></article></section>' +
          '<section class="zegger-erp__module" data-view="company-users"><article class="zegger-erp__panel"><div class="zegger-erp__panel-head"><h2>Uzytkownicy firmy</h2><div class="zegger-erp__actions"><button class="zegger-erp__btn" type="button" data-action="users-refresh">Odswiez</button><button class="zegger-erp__btn" type="button" data-action="users-new-code">Nowy kod</button></div></div><div id="z-users-meta" class="zegger-erp__note"></div><div class="zegger-erp__table-wrap"><table class="zegger-erp__table"><thead><tr><th>Login</th><th>Rola</th><th>Sprzedawca</th><th>Utworzono</th><th>Aktywnosc</th></tr></thead><tbody id="z-users-rows"><tr><td colspan="5" class="zegger-erp__muted">Ladowanie...</td></tr></tbody></table></div><h3 class="zegger-erp__section-title">Kody dolaczenia</h3><ul id="z-users-codes" class="zegger-erp__simple-list"><li class="zegger-erp__muted">Brak danych.</li></ul></article></section>' +
          '<section class="zegger-erp__module" data-view="product-library"><article class="zegger-erp__panel"><div class="zegger-erp__panel-head"><h2>Biblioteka produktow</h2><div class="zegger-erp__actions"><button class="zegger-erp__btn" type="button" data-action="products-refresh">Odswiez cache</button><button class="zegger-erp__btn" type="button" data-action="products-sync">Synchronizuj Sheets</button></div></div><div id="z-products-meta" class="zegger-erp__note">Ladowanie...</div><div class="zegger-erp__table-wrap"><table class="zegger-erp__table"><thead><tr><th>Zakladka</th><th>Wiersze</th><th>Pola</th></tr></thead><tbody id="z-products-rows"><tr><td colspan="3" class="zegger-erp__muted">Ladowanie...</td></tr></tbody></table></div><h3 class="zegger-erp__section-title">Podglad</h3><ul id="z-products-preview" class="zegger-erp__simple-list"><li class="zegger-erp__muted">Brak danych.</li></ul></article></section>' +
          '<section class="zegger-erp__module" data-view="messenger"><article class="zegger-erp__panel"><div class="zegger-erp__panel-head"><h2>Messenger zespolu</h2><div class="zegger-erp__actions"><button class="zegger-erp__btn" type="button" data-action="messenger-refresh">Odswiez</button></div></div><div id="z-msg-meta" class="zegger-erp__note"></div><div id="z-msg-list" class="zegger-erp__chat-list"><div class="zegger-erp__muted">Ladowanie...</div></div><form id="z-msg-form" class="zegger-erp__chat-form" autocomplete="off"><textarea id="z-msg-text" class="zegger-erp__textarea" rows="3" maxlength="1500" placeholder="Wpisz wiadomosc..."></textarea><button id="z-msg-send" class="zegger-erp__btn zegger-erp__btn--primary" type="submit">Wyslij</button></form></article></section>' +
          '<section class="zegger-erp__module" data-view="notifications"><article class="zegger-erp__panel"><div class="zegger-erp__panel-head"><h2>Powiadomienia</h2><div class="zegger-erp__actions"><button class="zegger-erp__btn" type="button" data-action="notifications-refresh">Odswiez</button></div></div><div id="z-notifs-meta" class="zegger-erp__note"></div><ul id="z-notifs-list" class="zegger-erp__activity-list"><li class="zegger-erp__muted">Ladowanie...</li></ul></article></section>' +
        '</main>' +
        '<nav class="zegger-erp__mobile-nav">' + mob + '</nav>' +
      '</div>';
  }

  function renderShell() {
    if (!state.mounted) {
      root.innerHTML = shellMarkup();
      mountOfferFrame();
      state.mounted = true;
    }
    updateTopbar();
    applyMod(state.activeMod, true);
    setOfferDirty(state.offerDirty);
    setMsgDirty(state.msgDirty);
  }

  function setOfferDirty(v) { state.offerDirty = !!v; updateUnsaved(); }
  function setMsgDirty(v) { state.msgDirty = !!v; updateUnsaved(); }

  function updateTopbar() {
    var acc = doc.getElementById('zegger-erp-account');
    var title = doc.getElementById('zegger-erp-title');
    var login = state.account && state.account.login ? String(state.account.login) : '-';
    var cname = state.company && state.company.name ? String(state.company.name) : '-';
    var role = state.company && state.company.role ? String(state.company.role) : '-';
    if (acc) { acc.textContent = login + ' | ' + cname + ' | ' + role; }
    if (title) { title.textContent = modTitle(state.activeMod); }
    updateUnsaved();
  }

  function updateUnsaved() {
    var el = doc.getElementById('zegger-erp-unsaved');
    if (!el) { return; }
    var dirty = hasUnsaved();
    el.classList.toggle('is-dirty', dirty);
    el.textContent = dirty ? 'Niezapisane zmiany' : 'Brak zmian';
  }

  function applySession(data) {
    state.auth = !!(data && data.authenticated);
    if (!state.auth) {
      state.account = null; state.actor = null; state.company = null;
      setOfferDirty(false); setMsgDirty(false);
      return;
    }
    state.account = data.account || null;
    state.actor = data.actor || null;
    state.company = data.company || null;
    state.activeMod = normMod(state.activeMod);
  }

  async function refreshSession(showErr) {
    try {
      var data = await reqErp('/session');
      applySession(data || {});
      if (!state.auth) { renderAuth(''); return; }
      renderShell();
      loadModule(state.activeMod, true);
      if (state.activeMod === 'offers') { sendOfferOpen('session-refresh'); }
    } catch (err) {
      state.auth = false;
      state.account = null;
      state.actor = null;
      state.company = null;
      setOfferDirty(false);
      setMsgDirty(false);
      renderAuth(showErr ? (err && err.message ? String(err.message) : 'Brak polaczenia z ERP API.') : '');
    }
  }
  function bindListeners() {
    if (state.listeners) { return; }
    state.listeners = true;

    root.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t) { return; }

      var modeBtn = t.closest('[data-auth-mode]');
      if (modeBtn) {
        ev.preventDefault();
        var mode = String(modeBtn.getAttribute('data-auth-mode') || 'login');
        state.authMode = (mode === 'register-company' || mode === 'join-company') ? mode : 'login';
        renderAuth('');
        return;
      }

      var modBtn = t.closest('[data-module]');
      if (modBtn && state.auth) {
        ev.preventDefault();
        requestModSwitch(modBtn.getAttribute('data-module'));
        return;
      }

      var act = t.closest('[data-action]');
      if (!act) { return; }
      ev.preventDefault();

      var a = String(act.getAttribute('data-action') || '');
      if (a === 'logout') { handleLogout(); return; }
      if (a === 'start-refresh') { loadStart(true); return; }
      if (a === 'open-offers') { requestModSwitch('offers'); return; }
      if (a === 'users-refresh') { loadUsers(true); return; }
      if (a === 'users-new-code') { createCode(); return; }
      if (a === 'products-refresh') { loadProducts(true, false); return; }
      if (a === 'products-sync') { loadProducts(true, true); return; }
      if (a === 'messenger-refresh') { loadMessenger(true); return; }
      if (a === 'notifications-refresh') { loadNotifications(true); return; }
    });

    root.addEventListener('submit', function (ev) {
      var f = ev.target;
      if (!f || f.nodeType !== 1) { return; }
      if (f.id === 'zegger-erp-auth-form') { ev.preventDefault(); submitAuth(f); return; }
      if (f.id === 'z-msg-form') { ev.preventDefault(); submitMsg(); }
    });

    root.addEventListener('input', function (ev) {
      var t = ev.target;
      if (t && t.id === 'z-msg-text') {
        setMsgDirty(String(t.value || '').trim().length > 0);
      }
    });

    window.addEventListener('message', onOfferMessage);
    window.addEventListener('beforeunload', function (ev) {
      if (!state.auth || !hasUnsaved()) { return; }
      ev.preventDefault();
      ev.returnValue = '';
    });
  }

  async function submitAuth(form) {
    var msg = doc.getElementById('zegger-erp-auth-msg');
    var btn = doc.getElementById('zegger-erp-auth-submit');
    if (btn) { btn.disabled = true; }
    if (msg) { msg.textContent = 'Trwa logowanie...'; }

    var fd = new FormData(form);
    var p = {};
    fd.forEach(function (v, k) { p[k] = String(v || '').trim(); });

    var endpoint = '/session/login';
    if (state.authMode === 'register-company') endpoint = '/session/register-company';
    if (state.authMode === 'join-company') endpoint = '/session/join-company';

    try {
      var data = await reqErp(endpoint, { method: 'POST', json: p });
      applySession(data);
      state.flash = data && data.message ? String(data.message) : 'Sesja aktywna.';
      state.joinCode = data && data.join_code ? String(data.join_code) : '';
      renderShell();
      loadModule(state.activeMod, true);
      if (state.activeMod === 'offers') { sendOfferOpen('auth-success'); }
    } catch (err) {
      if (msg) { msg.textContent = err && err.message ? String(err.message) : 'Blad logowania.'; }
    } finally {
      if (btn) { btn.disabled = false; }
    }
  }

  async function handleLogout() {
    if (hasUnsaved()) {
      var leave = (boot.ui && boot.ui.confirmLeave) ? String(boot.ui.confirmLeave) : 'Masz niezapisane zmiany. Wylogowac?';
      if (!window.confirm(leave)) { return; }
    }

    try { await reqErp('/session/logout', { method: 'POST', json: {} }); } catch (e) {}

    state.auth = false;
    state.account = null;
    state.actor = null;
    state.company = null;
    state.flash = 'Wylogowano.';
    state.joinCode = '';
    state.cache.messages = [];
    state.cache.notifications = [];
    setOfferDirty(false);
    setMsgDirty(false);

    renderAuth('Wylogowano.');
  }

  function requestModSwitch(next) {
    next = normMod(next);
    if (next === state.activeMod) {
      if (next === 'offers') { sendOfferOpen('same-module'); }
      return;
    }

    if (state.activeMod === 'offers' && state.offerDirty) {
      var m1 = (boot.ui && boot.ui.confirmLeave) ? String(boot.ui.confirmLeave) : 'Masz niezapisane zmiany. Opujsc modul?';
      if (!window.confirm(m1)) { return; }
    }

    if (state.activeMod === 'messenger' && state.msgDirty) {
      if (!window.confirm('Masz szkic wiadomosci. Opujsc modul?')) { return; }
      setMsgDirty(false);
    }

    applyMod(next, false);
  }

  function applyMod(mod, skipPersist) {
    state.activeMod = normMod(mod);

    if (!skipPersist) {
      writeLS(MOD_STORAGE, state.activeMod);
      updateHistory(state.activeMod);
    }

    var nav = root.querySelectorAll('[data-module]');
    nav.forEach(function (btn) {
      var key = String(btn.getAttribute('data-module') || '');
      btn.classList.toggle('is-active', key === state.activeMod);
    });

    var views = root.querySelectorAll('[data-view]');
    views.forEach(function (view) {
      var key = String(view.getAttribute('data-view') || '');
      view.classList.toggle('is-active', key === state.activeMod);
    });

    var title = doc.getElementById('zegger-erp-title');
    if (title) { title.textContent = modTitle(state.activeMod); }

    if (state.activeMod === 'offers') { sendOfferOpen('mod-switch'); }

    loadModule(state.activeMod, false);
  }

  function updateHistory(mod) {
    if (!window.history || !window.history.replaceState) { return; }
    var base = String(boot.routes.app || '').trim();
    if (!base) { return; }
    base = base.replace(/\/+$/g, '') + '/';
    var url = (mod === 'start') ? base : (base + encodeURIComponent(mod) + '/');
    try { window.history.replaceState({ module: mod }, '', url); } catch (e) {}
  }

  function loadModule(mod, force) {
    if (mod === 'start') { loadStart(!!force); return; }
    if (mod === 'company-users') { loadUsers(!!force); return; }
    if (mod === 'product-library') { loadProducts(!!force, false); return; }
    if (mod === 'messenger') { loadMessenger(!!force); return; }
    if (mod === 'notifications') { loadNotifications(!!force); }
  }

  async function loadStart(force) {
    if (!state.auth || !state.mounted || state.loading.start) { return; }
    if (!force && isFresh('start', 20000)) { renderStart(); return; }
    state.loading.start = true;

    var rows = doc.getElementById('z-start-offers-rows');
    if (rows) { rows.innerHTML = '<tr><td colspan="4" class="zegger-erp__muted">Ladowanie...</td></tr>'; }

    try {
      var out = await Promise.all([
        reqLegacy('/offers'),
        reqLegacy('/profile').catch(function () { return null; }),
        reqErp('/notifications', { query: { limit: 8 } }).catch(function () { return null; })
      ]);

      state.cache.offers = Array.isArray(out[0].offers) ? out[0].offers : [];
      state.cache.profile = out[1] && out[1].stats ? out[1].stats : null;
      if (out[2] && Array.isArray(out[2].notifications)) { state.cache.notifications = out[2].notifications; }

      state.loadedAt.start = Date.now();
      renderStart();
    } catch (err) {
      if (err && err.status === 401) { refreshSession(true); return; }
      if (rows) { rows.innerHTML = '<tr><td colspan="4" class="zegger-erp__muted">Blad: ' + esc(err && err.message ? err.message : 'unknown') + '</td></tr>'; }
    } finally {
      state.loading.start = false;
    }
  }

  function renderStart() {
    var stats = state.cache.profile || {};
    var offers = Array.isArray(state.cache.offers) ? state.cache.offers : [];
    var sc = stats.status_counts && typeof stats.status_counts === 'object' ? stats.status_counts : {};

    var account = doc.getElementById('z-start-account');
    var company = doc.getElementById('z-start-company');
    var nOffers = doc.getElementById('z-start-offers');
    var nClients = doc.getElementById('z-start-clients');
    var tTotal = doc.getElementById('z-start-time');
    var nNew = doc.getElementById('z-start-new');
    var info = doc.getElementById('zegger-erp-start-msg');

    if (account) { account.textContent = state.account && state.account.login ? state.account.login : '-'; }
    if (company) {
      var name = state.company && state.company.name ? state.company.name : '-';
      var role = state.company && state.company.role ? state.company.role : '-';
      company.textContent = name + ' (' + role + ')';
    }
    if (nOffers) { nOffers.textContent = String(Number(stats.offers_count || offers.length)); }
    if (nClients) { nClients.textContent = String(Number(stats.clients_count || 0)); }
    if (tTotal) { tTotal.textContent = mins(stats.time_total_sec || 0); }
    if (nNew) { nNew.textContent = String(Number(sc.new || 0)); }

    if (info) {
      var chunks = [];
      if (state.flash) chunks.push(state.flash);
      if (state.joinCode) chunks.push('Kod dolaczenia: ' + state.joinCode);
      info.textContent = chunks.join(' | ');
      state.flash = '';
      state.joinCode = '';
    }

    var rows = doc.getElementById('z-start-offers-rows');
    if (rows) {
      if (!offers.length) {
        rows.innerHTML = '<tr><td colspan="4" class="zegger-erp__muted">Brak ofert.</td></tr>';
      } else {
        rows.innerHTML = offers.slice(0, 8).map(function (o) {
          return '<tr><td>' + esc(o.id || '-') + '</td><td>' + esc(String(o.title || '(bez tytulu)').slice(0, 96)) + '</td><td><span class="zegger-erp__status">' + esc(o.status || 'unset') + '</span></td><td>' + esc(dt(o.updated_at || '')) + '</td></tr>';
        }).join('');
      }
    }

    var list = doc.getElementById('z-start-notifs');
    if (list) {
      var items = Array.isArray(state.cache.notifications) ? state.cache.notifications : [];
      if (!items.length) list.innerHTML = '<li class="zegger-erp__muted">Brak zdarzen.</li>';
      else list.innerHTML = items.slice(0, 8).map(function (n) {
        var lbl = n.event_label || n.event || 'Zdarzenie';
        var msg = n.message || '';
        var who = n.account_login || '';
        return '<li><strong>' + esc(lbl) + '</strong>' + (msg ? '<span>' + esc(msg) + '</span>' : '') + '<small>' + esc(dt(n.created_at || '') + (who ? (' | ' + who) : '')) + '</small></li>';
      }).join('');
    }
  }
  async function loadUsers(force) {
    if (!state.auth || !state.mounted || state.loading.users) { return; }
    if (!force && isFresh('users', 20000) && state.cache.users) { renderUsers(); return; }
    state.loading.users = true;

    try {
      var users = await reqErp('/company/users');
      var codes = [];
      if (users && users.can_manage) {
        var c = await reqErp('/company/join-codes').catch(function () { return null; });
        codes = c && Array.isArray(c.codes) ? c.codes : [];
      }
      state.cache.users = users;
      state.cache.codes = codes;
      state.loadedAt.users = Date.now();
      renderUsers();
    } catch (err) {
      if (err && err.status === 401) { refreshSession(true); return; }
      setTxt('z-users-meta', 'Blad pobierania: ' + (err && err.message ? err.message : 'unknown'));
    } finally {
      state.loading.users = false;
    }
  }

  function renderUsers() {
    var data = state.cache.users || {};
    var users = Array.isArray(data.users) ? data.users : [];
    var can = !!data.can_manage;

    setTxt('z-users-meta', 'Liczba kont: ' + users.length + '. Rola: ' + ((data.company && data.company.role) || '-'));

    var rows = doc.getElementById('z-users-rows');
    if (rows) {
      if (!users.length) rows.innerHTML = '<tr><td colspan="5" class="zegger-erp__muted">Brak kont.</td></tr>';
      else rows.innerHTML = users.map(function (u) {
        var seller = u.seller_name ? u.seller_name : '-';
        if (u.seller_email) seller += ' (' + u.seller_email + ')';
        return '<tr><td>' + esc(u.login || '-') + '</td><td><span class="zegger-erp__status">' + esc(u.role || 'member') + '</span></td><td>' + esc(seller) + '</td><td>' + esc(dt(u.created_at || '')) + '</td><td>' + esc(dt(u.last_seen || u.updated_at || '')) + '</td></tr>';
      }).join('');
    }

    var btn = root.querySelector('[data-action="users-new-code"]');
    if (btn) btn.disabled = !can;

    var codes = doc.getElementById('z-users-codes');
    if (codes) {
      if (!can) codes.innerHTML = '<li class="zegger-erp__muted">Brak uprawnien do kodow.</li>';
      else if (!state.cache.codes.length) codes.innerHTML = '<li class="zegger-erp__muted">Brak aktywnych kodow.</li>';
      else codes.innerHTML = state.cache.codes.map(function (c) {
        return '<li><strong>' + esc(c.code || '-') + '</strong><small>Wazny do: ' + esc(dt(c.expires_at || '')) + '</small></li>';
      }).join('');
    }
  }

  async function createCode() {
    var btn = root.querySelector('[data-action="users-new-code"]');
    if (btn) btn.disabled = true;
    try {
      var res = await reqErp('/company/join-codes', { method: 'POST', json: { expires_days: 30 } });
      if (res && res.code && res.code.code) state.flash = 'Nowy kod: ' + res.code.code;
      await loadUsers(true);
      setTxt('z-users-meta', state.flash || 'Kod utworzony.');
      state.flash = '';
    } catch (err) {
      setTxt('z-users-meta', 'Nie udalo sie utworzyc kodu: ' + (err && err.message ? err.message : 'unknown'));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function loadProducts(force, sync) {
    if (!state.auth || !state.mounted || state.loading.products) { return; }
    if (!force && !sync && isFresh('products', 30000) && state.cache.sheets && Object.keys(state.cache.sheets).length) { renderProducts(); return; }
    state.loading.products = true;

    setTxt('z-products-meta', sync ? 'Synchronizacja z Sheets...' : 'Ladowanie cache...');
    try {
      var res = await reqLegacy('/sheets', { query: sync ? { force: '1' } : null });
      state.cache.sheets = (res && res.data && typeof res.data === 'object') ? res.data : {};
      state.cache.sheetsMeta = res && res.meta ? res.meta : null;
      state.loadedAt.products = Date.now();
      renderProducts();
    } catch (err) {
      if (err && err.status === 401) { refreshSession(true); return; }
      setTxt('z-products-meta', 'Blad pobierania: ' + (err && err.message ? err.message : 'unknown'));
      setHtml('z-products-rows', '<tr><td colspan="3" class="zegger-erp__muted">Brak danych.</td></tr>');
    } finally {
      state.loading.products = false;
    }
  }

  function fieldsOf(obj) {
    if (!obj || typeof obj !== 'object') return '-';
    var keys = Object.keys(obj).filter(function (k) { var v = obj[k]; return k && v !== null && v !== undefined && String(v).trim() !== ''; });
    return keys.length ? keys.slice(0, 3).join(', ') : '-';
  }

  function rowPreview(obj) {
    if (!obj || typeof obj !== 'object') return '-';
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = obj[k];
      if (v === null || v === undefined) continue;
      var s = String(v).trim();
      if (!s) continue;
      return k + ': ' + s.slice(0, 96);
    }
    return '-';
  }

  function renderProducts() {
    var sheets = state.cache.sheets || {};
    var tabs = Object.keys(sheets);
    var total = 0;
    var rows = tabs.map(function (t) {
      var list = Array.isArray(sheets[t]) ? sheets[t] : [];
      total += list.length;
      return '<tr><td>' + esc(t) + '</td><td>' + esc(list.length) + '</td><td>' + esc(list.length ? fieldsOf(list[0]) : '-') + '</td></tr>';
    }).join('');

    var meta = state.cache.sheetsMeta || {};
    var hash = meta.data_hash ? String(meta.data_hash) : '-';
    var fetched = meta.fetched_at ? dt(meta.fetched_at) : '-';
    setTxt('z-products-meta', 'Zakladki: ' + tabs.length + ' | Wiersze: ' + total + ' | Cache: ' + fetched + ' | Hash: ' + hash);

    setHtml('z-products-rows', rows || '<tr><td colspan="3" class="zegger-erp__muted">Brak danych.</td></tr>');

    var preview = doc.getElementById('z-products-preview');
    if (!preview) return;
    if (!tabs.length) { preview.innerHTML = '<li class="zegger-erp__muted">Brak podgladu.</li>'; return; }

    var first = tabs[0];
    var list = Array.isArray(sheets[first]) ? sheets[first] : [];
    if (!list.length) { preview.innerHTML = '<li class="zegger-erp__muted">Zakladka "' + esc(first) + '" jest pusta.</li>'; return; }

    preview.innerHTML = list.slice(0, 8).map(function (row) {
      return '<li><strong>' + esc(first) + '</strong><span>' + esc(rowPreview(row)) + '</span></li>';
    }).join('');
  }

  async function loadMessenger(force) {
    if (!state.auth || !state.mounted || state.loading.messenger) { return; }
    if (!force && isFresh('messenger', 8000)) { renderMessenger(); return; }
    state.loading.messenger = true;

    setTxt('z-msg-meta', 'Ladowanie wiadomosci...');
    try {
      var res = await reqErp('/messenger/messages', { query: { limit: 120 } });
      state.cache.messages = Array.isArray(res.messages) ? res.messages : [];
      state.loadedAt.messenger = Date.now();
      renderMessenger();
    } catch (err) {
      if (err && err.status === 401) { refreshSession(true); return; }
      setTxt('z-msg-meta', 'Blad ladowania: ' + (err && err.message ? err.message : 'unknown'));
    } finally {
      state.loading.messenger = false;
    }
  }

  function renderMessenger() {
    var list = doc.getElementById('z-msg-list');
    if (!list) return;

    var rows = Array.isArray(state.cache.messages) ? state.cache.messages : [];
    setTxt('z-msg-meta', 'Wiadomosci: ' + rows.length);

    if (!rows.length) {
      list.innerHTML = '<div class="zegger-erp__muted">Brak wiadomosci. Napisz pierwsza.</div>';
      return;
    }

    list.innerHTML = rows.map(function (m) {
      var who = m.account_name || m.account_login || 'Uzytkownik';
      var cls = m.mine ? 'zegger-erp__chat-msg is-mine' : 'zegger-erp__chat-msg';
      return '<article class="' + cls + '"><header><strong>' + esc(who) + '</strong><small>' + esc(dt(m.created_at || '')) + '</small></header><p>' + esc(m.text || '') + '</p></article>';
    }).join('');

    try { list.scrollTop = list.scrollHeight; } catch (e) {}
  }

  async function submitMsg() {
    var textEl = doc.getElementById('z-msg-text');
    var sendBtn = doc.getElementById('z-msg-send');
    if (!textEl) return;

    var text = String(textEl.value || '').trim();
    if (!text) { setTxt('z-msg-meta', 'Wpisz tresc wiadomosci.'); return; }

    if (sendBtn) sendBtn.disabled = true;
    try {
      await reqErp('/messenger/messages', { method: 'POST', json: { text: text } });
      textEl.value = '';
      setMsgDirty(false);
      setTxt('z-msg-meta', 'Wiadomosc wyslana.');
      await loadMessenger(true);
    } catch (err) {
      if (err && err.status === 401) { refreshSession(true); return; }
      setTxt('z-msg-meta', 'Blad wysylki: ' + (err && err.message ? err.message : 'unknown'));
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  }
  async function loadNotifications(force) {
    if (!state.auth || !state.mounted || state.loading.notifications) { return; }
    if (!force && isFresh('notifications', 12000)) { renderNotifications(); return; }
    state.loading.notifications = true;

    setTxt('z-notifs-meta', 'Ladowanie powiadomien...');
    try {
      var res = await reqErp('/notifications', { query: { limit: 120 } });
      state.cache.notifications = Array.isArray(res.notifications) ? res.notifications : [];
      state.loadedAt.notifications = Date.now();
      renderNotifications();
    } catch (err) {
      if (err && err.status === 401) { refreshSession(true); return; }
      setTxt('z-notifs-meta', 'Blad ladowania: ' + (err && err.message ? err.message : 'unknown'));
    } finally {
      state.loading.notifications = false;
    }
  }

  function renderNotifications() {
    var list = doc.getElementById('z-notifs-list');
    if (!list) return;

    var rows = Array.isArray(state.cache.notifications) ? state.cache.notifications : [];
    setTxt('z-notifs-meta', 'Pozycji: ' + rows.length);

    if (!rows.length) { list.innerHTML = '<li class="zegger-erp__muted">Brak zdarzen.</li>'; return; }

    list.innerHTML = rows.map(function (n) {
      var lbl = n.event_label || n.event || 'Zdarzenie';
      var msg = n.message || '';
      var who = n.account_name || n.account_login || '-';
      var meta = dt(n.created_at || '') + ' | ' + who + (n.offer_id ? (' | oferta #' + n.offer_id) : '');
      return '<li><div class="zegger-erp__activity-head"><strong>' + esc(lbl) + '</strong><small>' + esc(meta) + '</small></div>' + (msg ? '<p>' + esc(msg) + '</p>' : '') + '</li>';
    }).join('');
  }

  function mountOfferFrame() {
    state.offerFrame = doc.getElementById('zegger-erp-offer-iframe');
    if (!state.offerFrame) return;
    state.offerFrame.setAttribute('src', String(boot.routes.offerPanel || ''));
    state.offerFrame.addEventListener('load', function () { sendOfferOpen('iframe-load'); });
  }

  function postOffer(type, payload, extra) {
    if (!state.offerFrame || !state.offerFrame.contentWindow) return;
    var pkt = Object.assign({ type: type }, extra || {});
    if (payload !== undefined) pkt.payload = payload;

    try { state.offerFrame.contentWindow.postMessage(pkt, window.location.origin); return; } catch (e) {}
    try { state.offerFrame.contentWindow.postMessage(pkt, '*'); } catch (e2) {}
  }

  function sendOfferOpen(reason) {
    if (!state.auth || !state.offerFrame || !state.offerFrame.contentWindow) return;
    state.offerSeq += 1;
    postOffer('zq:offer:open', {
      user: state.account && state.account.login ? String(state.account.login) : '',
      account: state.account || null,
      host: 'zegger-erp-shell',
      reason: String(reason || 'open'),
      ts: Date.now()
    }, { host_seq: state.offerSeq });
  }

  function parseOfferId(v) { return String(v == null ? '' : v).replace(/[^0-9]/g, '') || ''; }

  async function handleOfferExport(payload) {
    if (!payload || typeof payload !== 'object' || state.exportBusy) return;
    state.exportBusy = true;

    var oid = parseOfferId(payload.offer_id || '');
    var endpoint = oid ? ('/offers/' + oid + '/export') : '/offers/export';
    var body = {
      title: payload.title ? String(payload.title) : 'Oferta',
      comment: payload.comment ? String(payload.comment) : '',
      data: payload.data || null,
      status: payload.status ? String(payload.status) : 'unset'
    };
    if (payload.nonce) body.nonce = String(payload.nonce);

    try {
      var out = await reqLegacy(endpoint, { method: 'POST', json: body });
      postOffer('zq:offer:export:done', { ok: true, id: out && out.id ? String(out.id) : oid, title: out && out.title ? String(out.title) : body.title, nonce: body.nonce || '' });
    } catch (err) {
      postOffer('zq:offer:export:done', { ok: false, message: err && err.message ? String(err.message) : 'Blad eksportu PDF.', nonce: body.nonce || '' });
    } finally {
      state.exportBusy = false;
    }
  }

  function onOfferMessage(ev) {
    if (!state.offerFrame || !state.offerFrame.contentWindow) return;
    if (ev.source !== state.offerFrame.contentWindow) return;
    if (ev.origin && ev.origin !== window.location.origin) return;

    var d = ev.data;
    if (!d || typeof d !== 'object') return;

    if (d.type === 'zq:offer:closed') { requestModSwitch('start'); return; }
    if (d.type === 'zq:offer:dirty') { setOfferDirty(!!(d.payload && d.payload.dirty)); return; }
    if (d.type === 'zq:offer:auth:required') { refreshSession(true); return; }
    if (d.type === 'zq:offer:export_pdf') { handleOfferExport(d.payload || null); return; }
  }

  function setTxt(id, txt) {
    var el = doc.getElementById(id);
    if (el) el.textContent = String(txt || '');
  }

  function setHtml(id, html) {
    var el = doc.getElementById(id);
    if (el) el.innerHTML = String(html || '');
  }
})();