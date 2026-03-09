(function(){
  'use strict';

  var boot = window.ZEGGER_ERP_BOOT || null;
  var DOC = document;
  var root = DOC.getElementById('zegger-erp-app');

  if (!boot || !boot.rest || !boot.routes || !root) {
    return;
  }

  var STORAGE_MODULE = 'zegger_erp_module_v1';
  var STORAGE_TOKEN = 'zegger_erp_token_v1';

  var state = {
    authenticated: false,
    account: null,
    actor: null,
    token: '',
    mountedShell: false,
    shellActionsBound: false,
    activeModule: normModule(readStorage(STORAGE_MODULE) || boot.initialModule),
    offersDirty: false,
    offerFrame: null,
    offerOpenSeq: 0,
    offerExportBusy: false,
    startLoading: false,
    lastOffers: []
  };

  function normModule(v){
    v = String(v || '').toLowerCase();
    return (v === 'offers') ? 'offers' : 'start';
  }

  function readStorage(key){
    try { return window.sessionStorage.getItem(key); } catch (e) { return null; }
  }

  function writeStorage(key, value){
    try {
      if (value === null || value === undefined || value === '') {
        window.sessionStorage.removeItem(key);
      } else {
        window.sessionStorage.setItem(key, String(value));
      }
    } catch (e) {}
  }

  function escapeHtml(input){
    return String(input == null ? '' : input)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function joinNs(ns, path){
    var base = String(ns || '').replace(/\/+$/g, '');
    var p = String(path || '').replace(/^\/+/, '');
    return base + '/' + p;
  }

  function buildRestUrl(nsPath, query){
    var url = new URL(window.location.origin + '/');
    url.searchParams.set('rest_route', nsPath);
    if (query && typeof query === 'object') {
      Object.keys(query).forEach(function(k){
        if (!k) { return; }
        var val = query[k];
        if (val === null || val === undefined || val === '') { return; }
        url.searchParams.set(k, String(val));
      });
    }
    return url.toString();
  }

  async function request(nsPath, opts){
    opts = opts || {};

    var headers = Object.assign({
      'Accept': 'application/json'
    }, opts.headers || {});

    var token = '';
    if (typeof opts.tokenOverride === 'string' && opts.tokenOverride) {
      token = opts.tokenOverride;
    } else if (state.token) {
      token = state.token;
    }
    if (token) {
      headers.Authorization = 'Bearer ' + token;
      headers['X-ZQ-Token'] = token;
    }

    var fetchOpts = {
      method: opts.method || 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: headers
    };

    if (opts.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      fetchOpts.body = JSON.stringify(opts.json);
    }

    var response = await fetch(buildRestUrl(nsPath, opts.query), fetchOpts);
    var data = null;

    try { data = await response.json(); } catch (e) { data = null; }

    if (!response.ok) {
      var httpMsg = (data && data.message) ? String(data.message) : ('HTTP ' + response.status);
      var httpErr = new Error(httpMsg);
      httpErr.status = response.status;
      httpErr.payload = data;
      throw httpErr;
    }

    if (!data || (typeof data === 'object' && data.ok === false)) {
      var apiMsg = (data && data.message) ? String(data.message) : 'Niepoprawna odpowiedÄąĹź API.';
      var apiErr = new Error(apiMsg);
      apiErr.status = response.status;
      apiErr.payload = data;
      throw apiErr;
    }

    return data;
  }

  function requestErp(path, opts){
    return request(joinNs(boot.rest.erpNs, path), opts);
  }

  function requestLegacy(path, opts){
    return request(joinNs(boot.rest.legacyNs, path), opts);
  }

  function setDirtyFlag(isDirty){
    state.offersDirty = !!isDirty;
    var badge = DOC.getElementById('zegger-erp-dirty');
    if (!badge) { return; }
    badge.classList.toggle('is-dirty', state.offersDirty);
    badge.textContent = state.offersDirty ? 'Niezapisane zmiany' : 'Brak zmian';
  }

  function beforeUnloadHandler(ev){
    if (!state.authenticated || !state.offersDirty) { return; }
    ev.preventDefault();
    ev.returnValue = '';
  }

  function renderLoginView(message){
    state.mountedShell = false;
    root.innerHTML = '' +
      '<div class="zegger-erp__center">' +
        '<section class="zegger-erp__login" aria-labelledby="zegger-erp-login-title">' +
          '<div class="zegger-erp__logo"><span class="zegger-erp__logo-dot" aria-hidden="true"></span> ZEGGER ERP Runtime</div>' +
          '<h1 id="zegger-erp-login-title" class="zegger-erp__title">Logowanie do ERP</h1>' +
          '<p class="zegger-erp__subtitle">Po zalogowaniu uruchamiasz docelowy shell ERP z moduÄąâ€šem ofertowym legacy.</p>' +
          '<form id="zegger-erp-login-form" class="zegger-erp__form" autocomplete="off">' +
            '<div class="zegger-erp__field">' +
              '<label for="zegger-erp-login">Login</label>' +
              '<input id="zegger-erp-login" class="zegger-erp__input" type="text" autocomplete="username" required>' +
            '</div>' +
            '<div class="zegger-erp__field">' +
              '<label for="zegger-erp-password">HasÄąâ€šo</label>' +
              '<input id="zegger-erp-password" class="zegger-erp__input" type="password" autocomplete="current-password" required>' +
            '</div>' +
            '<button id="zegger-erp-login-submit" class="zegger-erp__btn zegger-erp__btn--primary" type="submit">Zaloguj</button>' +
            '<div id="zegger-erp-login-msg" class="zegger-erp__msg" role="status" aria-live="polite">' + escapeHtml(message || '') + '</div>' +
          '</form>' +
        '</section>' +
      '</div>';

    var form = DOC.getElementById('zegger-erp-login-form');
    if (!form) { return; }
    form.addEventListener('submit', async function(ev){
      ev.preventDefault();
      var loginInput = DOC.getElementById('zegger-erp-login');
      var passInput = DOC.getElementById('zegger-erp-password');
      var submitBtn = DOC.getElementById('zegger-erp-login-submit');
      var msg = DOC.getElementById('zegger-erp-login-msg');

      var login = loginInput ? String(loginInput.value || '').trim() : '';
      var password = passInput ? String(passInput.value || '') : '';

      if (!login || !password) {
        if (msg) { msg.textContent = 'Podaj login i hasÄąâ€šo.'; }
        return;
      }

      if (submitBtn) { submitBtn.disabled = true; }
      if (msg) { msg.textContent = 'Logowanie...'; }

      try {
        var data = await requestErp('/session/login', {
          method: 'POST',
          json: {
            login: login,
            password: password
          }
        });

        state.authenticated = true;
        state.account = data.account || null;
        state.actor = data.actor || null;
        state.token = data.token ? String(data.token) : '';
        writeStorage(STORAGE_TOKEN, state.token || '');

        renderShell();
        loadStartData();
        if (state.activeModule === 'offers') {
          sendOfferOpen('login-success');
        }
      } catch (err) {
        if (msg) { msg.textContent = err && err.message ? String(err.message) : 'BÄąâ€šĂ„â€¦d logowania.'; }
      } finally {
        if (submitBtn) { submitBtn.disabled = false; }
      }
    });
  }

  function shellMarkup(){
    return '' +
      '<div class="zegger-erp__shell">' +
        '<header class="zegger-erp__topbar">' +
          '<div class="zegger-erp__topbar-left">' +
            '<div class="zegger-erp__logo"><span class="zegger-erp__logo-dot" aria-hidden="true"></span> ' + escapeHtml(boot.ui && boot.ui.brand ? boot.ui.brand : 'ZEGGER ERP') + '</div>' +
            '<span id="zegger-erp-user" class="zegger-erp__badge">...</span>' +
            '<span id="zegger-erp-dirty" class="zegger-erp__badge">Brak zmian</span>' +
          '</div>' +
          '<div class="zegger-erp__topbar-right">' +
            '<button class="zegger-erp__btn" type="button" data-action="refresh-start">OdÄąâ€şwieÄąÄ˝ start</button>' +
            '<button class="zegger-erp__btn" type="button" data-action="logout">Wyloguj</button>' +
          '</div>' +
        '</header>' +
        '<nav class="zegger-erp__nav" aria-label="ModuÄąâ€šy ERP">' +
          '<button class="zegger-erp__nav-btn" data-module="start" type="button">Start</button>' +
          '<button class="zegger-erp__nav-btn" data-module="offers" type="button">Panel ofert</button>' +
        '</nav>' +
        '<main class="zegger-erp__content">' +
          '<section class="zegger-erp__module" data-view="start">' +
            '<div class="zegger-erp__grid">' +
              '<article class="zegger-erp__card">' +
                '<h3>Sesja i konto</h3>' +
                '<div id="zegger-erp-account-meta" class="zegger-erp__muted">ÄąÂadowanie danych sesji...</div>' +
                '<div class="zegger-erp__stats">' +
                  '<div class="zegger-erp__stat"><span>Oferty</span><strong id="zegger-erp-stat-offers">-</strong></div>' +
                  '<div class="zegger-erp__stat"><span>Klienci</span><strong id="zegger-erp-stat-clients">-</strong></div>' +
                  '<div class="zegger-erp__stat"><span>Czas panelu</span><strong id="zegger-erp-stat-time">-</strong></div>' +
                  '<div class="zegger-erp__stat"><span>Status nowy</span><strong id="zegger-erp-stat-new">-</strong></div>' +
                '</div>' +
                '<p class="zegger-erp__muted">Kalkulator dziaÄąâ€ša teraz jako launcher - docelowy runtime dziaÄąâ€ša tutaj w ERP.</p>' +
                '<button id="zegger-erp-open-offers" class="zegger-erp__btn" type="button">PrzejdÄąĹź do panelu ofert</button>' +
              '</article>' +
              '<article class="zegger-erp__card">' +
                '<h3>Ostatnie oferty</h3>' +
                '<div class="zegger-erp__table-wrap">' +
                  '<table class="zegger-erp__table" aria-label="Ostatnie oferty">' +
                    '<thead><tr><th>ID</th><th>Nazwa</th><th>Status</th><th>Aktualizacja</th></tr></thead>' +
                    '<tbody id="zegger-erp-offers-rows"><tr><td colspan="4" class="zegger-erp__muted">ÄąÂadowanie...</td></tr></tbody>' +
                  '</table>' +
                '</div>' +
              '</article>' +
            '</div>' +
          '</section>' +
          '<section class="zegger-erp__module" data-view="offers">' +
            '<div class="zegger-erp__offer-wrap">' +
              '<iframe id="zegger-erp-offer-iframe" class="zegger-erp__offer-iframe" title="ModuÄąâ€š ofertowy ZEGGER" loading="eager"></iframe>' +
            '</div>' +
          '</section>' +
        '</main>' +
        '<nav class="zegger-erp__mobile-nav" aria-label="Nawigacja mobilna">' +
          '<button class="zegger-erp__nav-btn" data-module="start" type="button">Start</button>' +
          '<button class="zegger-erp__nav-btn" data-module="offers" type="button">Oferty</button>' +
        '</nav>' +
      '</div>';
  }

  function renderShell(){
    if (!state.mountedShell) {
      root.innerHTML = shellMarkup();
      bindShellActions();
      mountOfferFrame();
      state.mountedShell = true;
    }
    updateTopbar();
    applyModule(state.activeModule, true);
    setDirtyFlag(state.offersDirty);
  }

  function bindShellActions(){
    if (state.shellActionsBound) { return; }
    state.shellActionsBound = true;

    root.addEventListener('click', function(ev){
      var target = ev.target;
      if (!target) { return; }

      var moduleBtn = target.closest('[data-module]');
      if (moduleBtn) {
        ev.preventDefault();
        requestModuleSwitch(moduleBtn.getAttribute('data-module'));
        return;
      }

      var actionBtn = target.closest('[data-action]');
      if (actionBtn) {
        var action = String(actionBtn.getAttribute('data-action') || '');
        if (action === 'logout') {
          ev.preventDefault();
          handleLogout();
          return;
        }
        if (action === 'refresh-start') {
          ev.preventDefault();
          loadStartData(true);
          return;
        }
      }

      if (target.id === 'zegger-erp-open-offers') {
        ev.preventDefault();
        requestModuleSwitch('offers');
      }
    });
  }

  function updateTopbar(){
    var userEl = DOC.getElementById('zegger-erp-user');
    var metaEl = DOC.getElementById('zegger-erp-account-meta');

    var accountLogin = state.account && state.account.login ? String(state.account.login) : 'nieznany';
    var actorLogin = state.actor && state.actor.login ? String(state.actor.login) : accountLogin;

    if (userEl) {
      userEl.textContent = actorLogin === accountLogin ? ('Konto: ' + accountLogin) : ('Aktor: ' + actorLogin + ' / Konto: ' + accountLogin);
    }

    if (metaEl) {
      var perms = state.account && state.account.perms && typeof state.account.perms === 'object' ? state.account.perms : {};
      var chunks = [];
      chunks.push('Login: ' + accountLogin);
      chunks.push(perms.super_admin ? 'Rola: super_admin' : 'Rola: handlowiec');
      chunks.push(perms.can_view_all_clients ? 'Zakres klientÄ‚Ĺ‚w: wszyscy' : 'Zakres klientÄ‚Ĺ‚w: przypisani');
      metaEl.textContent = chunks.join(' | ');
    }
  }

  function requestModuleSwitch(next){
    next = normModule(next);
    if (next === state.activeModule) {
      if (next === 'offers') {
        sendOfferOpen('same-module');
      }
      return;
    }

    if (state.activeModule === 'offers' && state.offersDirty) {
      var msg = (boot.ui && boot.ui.confirmLeave) ? String(boot.ui.confirmLeave) : 'Masz niezapisane zmiany. KontynuowaĂ„â€ˇ?';
      if (!window.confirm(msg)) {
        return;
      }
    }

    applyModule(next, false);
  }

  function applyModule(module, skipPersist){
    state.activeModule = normModule(module);

    if (!skipPersist) {
      writeStorage(STORAGE_MODULE, state.activeModule);
    }

    var navButtons = root.querySelectorAll('[data-module]');
    navButtons.forEach(function(btn){
      var current = String(btn.getAttribute('data-module') || '');
      btn.classList.toggle('is-active', current === state.activeModule);
    });

    var views = root.querySelectorAll('[data-view]');
    views.forEach(function(view){
      var current = String(view.getAttribute('data-view') || '');
      view.classList.toggle('is-active', current === state.activeModule);
    });

    if (state.activeModule === 'offers') {
      sendOfferOpen('switch-module');
    } else {
      loadStartData(false);
    }
  }

  function mountOfferFrame(){
    state.offerFrame = DOC.getElementById('zegger-erp-offer-iframe');
    if (!state.offerFrame) { return; }

    state.offerFrame.setAttribute('src', String(boot.routes.offerPanel || ''));
    state.offerFrame.addEventListener('load', function(){
      sendOfferOpen('iframe-load');
    });
  }

  function postToOffer(type, payload, extra){
    if (!state.offerFrame || !state.offerFrame.contentWindow) { return; }

    var message = Object.assign({ type: type }, extra || {});
    if (payload !== undefined) {
      message.payload = payload;
    }

    try {
      state.offerFrame.contentWindow.postMessage(message, window.location.origin);
      return;
    } catch (e) {}

    try {
      state.offerFrame.contentWindow.postMessage(message, '*');
    } catch (e2) {}
  }

  function sendOfferOpen(reason){
    if (!state.authenticated || !state.offerFrame || !state.offerFrame.contentWindow) {
      return;
    }

    state.offerOpenSeq += 1;
    postToOffer('zq:offer:open', {
      user: state.account && state.account.login ? String(state.account.login) : '',
      token: state.token || '',
      account: state.account || null,
      host: 'zegger-erp-shell',
      reason: String(reason || 'open'),
      ts: Date.now()
    }, {
      host_seq: state.offerOpenSeq
    });
  }

  function parseOfferId(value){
    var txt = String(value == null ? '' : value).replace(/[^0-9]/g, '');
    return txt || '';
  }

  async function handleOfferExport(payload){
    if (!payload || typeof payload !== 'object') {
      return;
    }
    if (state.offerExportBusy) {
      return;
    }

    state.offerExportBusy = true;

    var nonce = payload.nonce ? String(payload.nonce) : '';
    var offerId = parseOfferId(payload.offer_id || '');
    var endpoint = offerId ? ('/offers/' + offerId + '/export') : '/offers/export';

    var body = {
      title: payload.title ? String(payload.title) : 'Oferta',
      comment: payload.comment ? String(payload.comment) : '',
      data: payload.data || null,
      status: payload.status ? String(payload.status) : 'unset',
      nonce: nonce
    };

    try {
      var json = await requestLegacy(endpoint, {
        method: 'POST',
        json: body,
        tokenOverride: payload.token ? String(payload.token) : ''
      });

      postToOffer('zq:offer:export:done', {
        ok: true,
        id: json.id ? String(json.id) : (offerId || ''),
        title: json.title ? String(json.title) : body.title,
        nonce: nonce
      });
    } catch (err) {
      postToOffer('zq:offer:export:done', {
        ok: false,
        message: err && err.message ? String(err.message) : 'BÄąâ€šĂ„â€¦d eksportu PDF.',
        nonce: nonce
      });
    } finally {
      state.offerExportBusy = false;
    }
  }

  async function handleLogout(){
    if (state.offersDirty) {
      var msg = (boot.ui && boot.ui.confirmLeave) ? String(boot.ui.confirmLeave) : 'Masz niezapisane zmiany. KontynuowaĂ„â€ˇ?';
      if (!window.confirm(msg)) {
        return;
      }
    }

    try {
      await requestErp('/session/logout', { method: 'POST', json: {} });
    } catch (e) {}

    state.authenticated = false;
    state.account = null;
    state.actor = null;
    state.token = '';
    state.offersDirty = false;
    writeStorage(STORAGE_TOKEN, '');

    renderLoginView('Wylogowano.');
  }

  function formatDate(raw){
    if (!raw) { return '-'; }
    var asIso = String(raw).replace(' ', 'T');
    var d = new Date(asIso);
    if (isNaN(d.getTime())) {
      return String(raw);
    }
    return d.toLocaleString('pl-PL');
  }

  function renderStatusBadge(status){
    status = String(status || 'unset');
    return '<span class="zegger-erp__status">' + escapeHtml(status) + '</span>';
  }

  function renderOfferRows(offers){
    var body = DOC.getElementById('zegger-erp-offers-rows');
    if (!body) { return; }

    if (!Array.isArray(offers) || offers.length === 0) {
      body.innerHTML = '<tr><td colspan="4" class="zegger-erp__muted">Brak ofert dla tego konta.</td></tr>';
      return;
    }

    var rows = offers.slice(0, 8).map(function(row){
      var id = row && row.id ? String(row.id) : '-';
      var title = row && row.title ? String(row.title) : '(bez nazwy)';
      var status = row && row.status ? String(row.status) : 'unset';
      var updatedAt = row && row.updated_at ? String(row.updated_at) : '';
      return '' +
        '<tr>' +
          '<td>' + escapeHtml(id) + '</td>' +
          '<td>' + escapeHtml(title) + '</td>' +
          '<td>' + renderStatusBadge(status) + '</td>' +
          '<td>' + escapeHtml(formatDate(updatedAt)) + '</td>' +
        '</tr>';
    });

    body.innerHTML = rows.join('');
  }

  async function loadStartData(force){
    if (!state.authenticated || !state.mountedShell) {
      return;
    }
    if (state.startLoading) {
      return;
    }
    if (!force && state.activeModule !== 'start') {
      return;
    }

    state.startLoading = true;
    var rows = DOC.getElementById('zegger-erp-offers-rows');
    if (rows) {
      rows.innerHTML = '<tr><td colspan="4" class="zegger-erp__muted">ÄąÂadowanie...</td></tr>';
    }

    try {
      var result = await Promise.all([
        requestLegacy('/offers'),
        requestLegacy('/profile').catch(function(){ return null; })
      ]);

      var offersResp = result[0] || {};
      var profileResp = result[1] || null;
      var offers = Array.isArray(offersResp.offers) ? offersResp.offers : [];

      state.lastOffers = offers;
      renderOfferRows(offers);

      var stats = profileResp && profileResp.stats ? profileResp.stats : null;
      var offersCount = stats && stats.offers_count != null ? Number(stats.offers_count) : offers.length;
      var clientsCount = stats && stats.clients_count != null ? Number(stats.clients_count) : 0;
      var timeSec = stats && stats.time_total_sec != null ? Number(stats.time_total_sec) : 0;
      var statusCounts = stats && stats.status_counts && typeof stats.status_counts === 'object' ? stats.status_counts : {};
      var newCount = statusCounts.new != null ? Number(statusCounts.new) : 0;

      var offersEl = DOC.getElementById('zegger-erp-stat-offers');
      var clientsEl = DOC.getElementById('zegger-erp-stat-clients');
      var timeEl = DOC.getElementById('zegger-erp-stat-time');
      var newEl = DOC.getElementById('zegger-erp-stat-new');

      if (offersEl) { offersEl.textContent = String(isFinite(offersCount) ? offersCount : 0); }
      if (clientsEl) { clientsEl.textContent = String(isFinite(clientsCount) ? clientsCount : 0); }
      if (timeEl) { timeEl.textContent = String(Math.max(0, Math.round(timeSec / 60))) + ' min'; }
      if (newEl) { newEl.textContent = String(isFinite(newCount) ? newCount : 0); }
    } catch (err) {
      if (rows) {
        rows.innerHTML = '<tr><td colspan="4" class="zegger-erp__muted">BÄąâ€šĂ„â€¦d pobierania danych: ' + escapeHtml(err && err.message ? err.message : 'unknown') + '</td></tr>';
      }
    } finally {
      state.startLoading = false;
    }
  }

  async function refreshSession(){
    var storedToken = readStorage(STORAGE_TOKEN);
    if (storedToken) {
      state.token = String(storedToken);
    }

    try {
      var data = await requestErp('/session');
      if (!data || !data.authenticated) {
        state.authenticated = false;
        state.account = null;
        state.actor = null;
        state.token = '';
        writeStorage(STORAGE_TOKEN, '');
        renderLoginView('');
        return;
      }

      state.authenticated = true;
      state.account = data.account || null;
      state.actor = data.actor || null;

      renderShell();
      loadStartData(true);
      if (state.activeModule === 'offers') {
        sendOfferOpen('session-refresh');
      }
    } catch (err) {
      state.authenticated = false;
      state.account = null;
      state.actor = null;
      state.token = '';
      writeStorage(STORAGE_TOKEN, '');
      renderLoginView(err && err.message ? err.message : 'Brak poÄąâ€šĂ„â€¦czenia z ERP API.');
    }
  }

  function onOfferMessage(event){
    if (!state.offerFrame || !state.offerFrame.contentWindow) {
      return;
    }
    if (event.source !== state.offerFrame.contentWindow) {
      return;
    }
    if (event.origin && event.origin !== window.location.origin) {
      return;
    }

    var data = event.data;
    if (!data || typeof data !== 'object') {
      return;
    }

    if (data.type === 'zq:offer:ready' || data.type === 'zq:offer:pong' || data.type === 'zq:offer:open:ack') {
      return;
    }

    if (data.type === 'zq:offer:closed') {
      requestModuleSwitch('start');
      return;
    }

    if (data.type === 'zq:offer:dirty') {
      var dirty = !!(data.payload && data.payload.dirty);
      setDirtyFlag(dirty);
      return;
    }

    if (data.type === 'zq:offer:token:update' || data.type === 'zq:auth:token:update') {
      var token = data && data.payload && data.payload.token ? String(data.payload.token) : '';
      if (token) {
        state.token = token;
        writeStorage(STORAGE_TOKEN, token);
      }
      return;
    }

    if (data.type === 'zq:offer:auth:required') {
      refreshSession();
      return;
    }

    if (data.type === 'zq:offer:export_pdf') {
      handleOfferExport(data.payload || null);
    }
  }

  window.addEventListener('message', onOfferMessage);
  window.addEventListener('beforeunload', beforeUnloadHandler);

  refreshSession();
})();
