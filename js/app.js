/* ============ Aio — Main app logic ============ */
'use strict';

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const ICONS = {
  copy: '<svg><use href="#i-copy"/></svg>',
  listen: '<svg><use href="#i-speaker"/></svg>',
  regen: '<svg><use href="#i-refresh"/></svg>'
};

const App = {
  activeId: null,
  generating: false,
  abortCtl: null,
  deferredInstall: null,
  recognition: null,
  voiceActive: false,
  voiceFinal: '',
  voiceTimer: null,
  voiceSeconds: 0,
  searchMode: false,

  /* ---------------- boot ---------------- */
  init() {
    this.settings = Store.settings();
    // migrate old 'demo' default → free built-in brain
    if (this.settings.provider === 'demo' && !this.settings.apiKey) {
      this.settings = Store.saveSettings({ provider: 'aio-free' });
    }
    I18N.init(this.settings.lang);

    this.applyTheme();
    this.applyAccent();
    this.buildLangSelect();
    this.fillSettingsUI();
    this.bindEvents();
    this.updateProfileUI();
    this.updateBadge();
    this.makeStars();
    I18N.apply();

    const last = Store.get('lastChat', null);
    if (last && Store.getChat(last)) this.open(last); else this.showWelcome();
    this.renderChatList();

    /* pre-warm: load the engine SDK early; if not signed in, show Connect.
       No ping call — it would burn one free DeepSeek request. */
    if (AI.isLive() && this.settings.provider === 'aio-free' && location.protocol !== 'file:') {
      setTimeout(async () => {
        const ok = await AI.ensurePuter();
        if (!ok) return;
        try {
          const signed = await window.puter.auth.isSignedIn();
          AI._puterOk = !!signed; AI._puterOkAt = Date.now(); // feed the race cache
          if (!signed) this.showConnectBanner();
          else this.toast(I18N.lang === 'fa' ? 'دیپ‌سیک آماده‌ست ⚡' : 'DeepSeek ready ⚡', 'ok');
        } catch (e) {}
      }, 2000);
    }
  },

  /* DeepSeek connectivity check (manual, from settings) */
  async pingDeepseek() {
    try {
      const p = await Promise.race([
        window.puter.ai.chat([{ role: 'user', content: 'ping' }], { model: 'deepseek-chat' }),
        AI.sleep(20000).then(() => ({ __t: true }))
      ]);
      if (p && !p.__t) {
        AI.puterDeadUntil = 0;
        AI.engDead = {};
        this.toast(I18N.lang === 'fa' ? 'دیپ‌سیک کامل وصل شد ✓' : 'DeepSeek fully connected ✓', 'ok');
        return true;
      }
      throw new Error('timeout');
    } catch (e) {
      this.toast(I18N.lang === 'fa'
        ? 'اتصال دیپ‌سیک هنوز کامل نشده — دکمه «وصل شو» رو بزن'
        : 'DeepSeek not fully connected — press "Connect"', 'err');
      return false;
    }
  },

  showConnectBanner() {
    if (document.getElementById('connectBanner')) return;
    const fa = I18N.lang === 'fa';
    const b = document.createElement('div');
    b.id = 'connectBanner';
    b.className = 'connect-banner';
    b.innerHTML = '<span class="cb-tx">⚡ ' + (fa
      ? 'برای اتصال کامل به دیپ‌سیک، یک بار ورود به Puter لازمه'
      : 'One quick sign-in to Puter unlocks the full DeepSeek brain') +
      '</span><button class="btn primary" id="connectBtn">' + (fa ? 'وصل شو' : 'Connect') + '</button>' +
      '<button class="icon-btn" id="connectClose" aria-label="Close"><svg><use href="#i-x"/></svg></button>';
    document.body.appendChild(b);
    $('#connectClose').onclick = () => b.remove();
    $('#connectBtn').onclick = async () => {
      const btn = $('#connectBtn');
      btn.disabled = true;
      btn.textContent = fa ? 'در حال اتصال…' : 'Connecting…';
      try {
        await window.puter.auth.signIn();
        const ok = await this.pingDeepseek();
        if (ok) b.remove();
      } catch (e) {
        this.toast(fa ? 'وصل نشد — دوباره امتحان کن' : 'Could not connect — try again', 'err');
      }
      btn.disabled = false;
      btn.textContent = fa ? 'وصل شو' : 'Connect';
    };
  },

  /* ---------------- helpers ---------------- */
  toast(msg, type) {
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 2400);
  },

  confirmAsk(text) {
    return new Promise(resolve => {
      $('#confirmText').textContent = text;
      $('#confirmModal').hidden = false;
      $('#confirmYes').onclick = () => { $('#confirmModal').hidden = true; resolve(true); };
      $('#confirmNo').onclick = () => { $('#confirmModal').hidden = true; resolve(false); };
    });
  },

  makeStars() {
    const box = $('#stars');
    if (!box || box.children.length) return;
    for (let i = 0; i < 40; i++) {
      const s = document.createElement('i');
      s.style.left = Math.random() * 100 + '%';
      s.style.top = Math.random() * 100 + '%';
      s.style.animationDelay = (Math.random() * 5) + 's';
      s.style.animationDuration = (2.5 + Math.random() * 4) + 's';
      box.appendChild(s);
    }
  },

  nearBottom() {
    const b = $('#messages');
    return b.scrollHeight - b.scrollTop - b.clientHeight < 130;
  },

  /* ---------------- theme / i18n ---------------- */
  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.settings.theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = this.settings.theme === 'light' ? '#f4f5fb' : '#0a0a18';
  },

  applyAccent() {
    document.documentElement.setAttribute('data-accent', this.settings.accent);
  },

  updateWelcome() {
    // the search-home screen is static (translated via data-i18n-ph / I18N.apply)
  },

  updateBadge() {
    const live = AI.isLive();
    const b = $('#modeBadge');
    b.textContent = AI.modeLabel();
    b.classList.toggle('live', live);
    b.title = live ? this.settings.provider : I18N.t('providerDemo');
    this.updateAiStatus();
  },

  updateAiStatus() {
    const box = $('#aiStatus'), txt = $('#aiStatusText');
    if (!box) return;
    const live = AI.isLive();
    box.classList.toggle('live', live);
    txt.textContent = live
      ? this.settings.provider + ' · ' + (this.settings.model || AI.PROVIDERS[this.settings.provider].model)
      : I18N.t('providerDemo');
  },

  updateProfileUI() {
    const ph = this.settings.userPhoto;
    const name = this.settings.userName || 'Aio User';
    const letter = this.settings.userName ? this.settings.userName.trim().charAt(0).toUpperCase() : '🙂';
    $('#sideAvatar').innerHTML = ph ? '<img src="' + ph + '" alt="">' : letter;
    $('#sideName').textContent = name;
    const img = $('#userPhotoImg'), em = $('#userPhotoEmoji');
    if (ph) { img.src = ph; img.hidden = false; em.hidden = true; }
    else { img.hidden = true; em.hidden = false; em.textContent = letter; }
    $('#photoName').textContent = name;
  },

  /* ---------------- sidebar / chats ---------------- */
  renderChatList() {
    const q = ($('#searchChats').value || '').trim().toLowerCase();
    let chats = Store.chats().slice().sort((a, b) => b.updatedAt - a.updatedAt);
    if (q) chats = chats.filter(c =>
      (c.title || '').toLowerCase().includes(q) ||
      c.messages.some(m => (m.content || '').toLowerCase().includes(q))
    );

    const box = $('#chatList');
    box.innerHTML = '';
    if (!chats.length) {
      box.innerHTML = '<div class="empty-list">' + MD.esc(I18N.t('noChats')) + '</div>';
      return;
    }
    for (const c of chats) {
      const el = document.createElement('div');
      el.className = 'chat-item' + (c.id === this.activeId ? ' active' : '');
      el.dataset.id = c.id;
      el.innerHTML =
        '<span class="ci-title">' + MD.esc(c.title || '…') + '</span>' +
        '<span class="ci-actions">' +
        '<button class="ci-ren" title="' + MD.esc(I18N.t('rename')) + '"><svg><use href="#i-pencil"/></svg></button>' +
        '<button class="ci-del del" title="' + MD.esc(I18N.t('delete')) + '"><svg><use href="#i-trash"/></svg></button>' +
        '</span>';
      el.addEventListener('click', e => {
        if (e.target.closest('.ci-ren')) { this.renameChat(c.id); return; }
        if (e.target.closest('.ci-del')) { this.deleteChat(c.id); return; }
        this.open(c.id);
        this.closeSidebar();
      });
      box.appendChild(el);
    }
  },

  renameChat(id) {
    const c = Store.getChat(id);
    if (!c) return;
    const name = window.prompt(I18N.t('renamePrompt'), c.title || '');
    if (name === null) return;
    Store.renameChat(id, name);
    this.renderChatList();
    if (id === this.activeId) $('#chatTitle').textContent = name || Store.getChat(id).title;
  },

  async deleteChat(id) {
    if (!await this.confirmAsk(I18N.t('deleteConfirm'))) return;
    Store.deleteChat(id);
    if (this.activeId === id) { this.activeId = null; this.showWelcome(); }
    this.renderChatList();
  },

  open(id) {
    this.activeId = id;
    Store.set('lastChat', id);
    const c = Store.getChat(id);
    $('#chatTitle').textContent = c ? (c.title || 'Aio') : 'Aio';
    this.renderMessages(c ? c.messages : []);
    this.renderChatList();
  },

  showWelcome() {
    $('#chatTitle').textContent = 'Aio';
    Store.set('lastChat', null);
    this.renderMessages([]);
  },

  /* ---------------- messages ---------------- */
  renderMessages(list) {
    const box = $('#messages');
    // remove only message nodes — the static welcome screen stays in the DOM
    box.querySelectorAll('.msg').forEach(n => n.remove());
    const w = $('#welcome');
    w.hidden = list.length > 0;
    w.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = I18N.t(el.getAttribute('data-i18n'));
    });
    this.updateWelcome();
    for (const m of list) box.appendChild(this.msgNode(m, false));
    this.scrollDown(false);
  },

  msgNode(m) {
    const el = document.createElement('div');
    el.className = 'msg ' + (m.role === 'assistant' ? 'ai' : 'user');

    if (m.role === 'assistant') {
      el.innerHTML =
        '<div class="msg-av"><svg><use href="#i-spark-w"/></svg></div>' +
        '<div class="msg-body">' +
        '<div class="msg-name">Aio <span class="nm-badge">' + MD.esc(AI.modeLabel()) + '</span></div>' +
        '<div class="msg-content"></div>' +
        '<div class="msg-actions">' +
        '<button class="ma-btn" data-act="copy" title="' + MD.esc(I18N.t('copy')) + '">' + ICONS.copy + '</button>' +
        '<button class="ma-btn" data-act="listen" title="' + MD.esc(I18N.t('listen')) + '">' + ICONS.listen + '</button>' +
        '<button class="ma-btn" data-act="regen" title="' + MD.esc(I18N.t('regenerate')) + '">' + ICONS.regen + '</button>' +
        '</div></div>';
      el.querySelector('.msg-content').innerHTML = MD.render(m.content);
      el.querySelector('.msg-actions').addEventListener('click', e => {
        const b = e.target.closest('.ma-btn');
        if (!b) return;
        if (b.dataset.act === 'copy') this.copyText(m.content, b);
        if (b.dataset.act === 'listen') this.speak(m.content);
        if (b.dataset.act === 'regen') this.regenerate();
      });
    } else {
      el.innerHTML = '<div class="msg-content">' + MD.esc(m.content) + '</div>' +
        '<div class="msg-actions">' +
        '<button class="ma-btn" data-act="copy" title="' + MD.esc(I18N.t('copy')) + '">' + ICONS.copy + '</button>' +
        '</div>';
      el.querySelector('.msg-actions').addEventListener('click', e => {
        const b = e.target.closest('.ma-btn');
        if (b && b.dataset.act === 'copy') this.copyText(m.content, b);
      });
    }
    return el;
  },

  copyText(txt, btn) {
    const done = () => {
      if (!btn) return;
      const ic = btn.querySelector('svg use');
      if (ic) {
        ic.setAttribute('href', '#i-check');
        setTimeout(() => ic.setAttribute('href', '#i-copy'), 1300);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done).catch(() => this.fallbackCopy(txt, done));
    } else this.fallbackCopy(txt, done);
  },
  fallbackCopy(txt, done) {
    const ta = document.createElement('textarea');
    ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove(); done && done();
  },

  scrollDown(smooth = true) {
    const box = $('#messages');
    box.scrollTo({ top: box.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  },

  /* ---------------- send / generate ---------------- */
  send(text, opts) {
    text = (text || '').trim();
    if (!text || this.generating) return;
    opts = opts || {};
    this.forceSearchOnce = !!opts.forceSearch;

    if (!this.activeId || !Store.getChat(this.activeId)) {
      const c = Store.createChat('');
      this.activeId = c.id;
    }
    const chatId = this.activeId;

    $('#welcome').hidden = true;

    Store.addMessage(chatId, { role: 'user', content: text });
    const chat = Store.getChat(chatId);
    if (chat && chat.messages.length === 1 && !chat.title) {
      Store.renameChat(chatId, text.slice(0, 48));
    }
    $('#chatTitle').textContent = Store.getChat(chatId).title || 'Aio';

    /* search-engine mode: the query lives in a search bar, not a chat bubble */
    if (!opts.forceSearch) {
      $('#messages').appendChild(this.msgNode({ role: 'user', content: text }));
    }
    this.scrollDown();
    this.renderChatList();

    const input = $('#input');
    input.value = '';
    input.style.height = 'auto';

    this.generate();
  },

  async generate() {
    const forceSearch = !!this.forceSearchOnce;
    this.forceSearchOnce = false;
    const chatId = this.activeId;
    const chat = Store.getChat(chatId);
    if (!chat) return;

    this.generating = true;
    this.setStopUI(true);

    // AI row with thinking indicator
    const node = document.createElement('div');
    node.className = 'msg ai';
    node.innerHTML =
      '<div class="msg-av"><svg><use href="#i-spark-w"/></svg></div>' +
      '<div class="msg-body">' +
      '<div class="msg-name">Aio <span class="nm-badge">' + MD.esc(AI.modeLabel()) + '</span></div>' +
      '<div class="msg-content"><span class="thinking"><i></i><i></i><i></i></span></div>' +
      '</div>';
    $('#messages').appendChild(node);
    const contentEl = node.querySelector('.msg-content');
    this.scrollDown();

    const history = chat.messages.map(m => ({ role: m.role, content: m.content }));
    this.abortCtl = new AbortController();
    const wasSearch = this.searchMode;
    let full = '';
    let lastRender = 0;

    /* search-engine layout: show the query in a mini search bar above results */
    if (forceSearch && history.length) {
      const q = history[history.length - 1].content;
      const pill = document.createElement('div');
      pill.className = 'query-pill';
      pill.innerHTML = '<svg><use href="#i-search"/></svg><span>' + MD.esc(q) + '</span>';
      node.querySelector('.msg-body').insertBefore(pill, contentEl);
    }

    const paint = force => {
      const now = Date.now();
      if (!force && now - lastRender < 60) return;
      lastRender = now;
      // live markdown render — formatted text grows, never raw symbols.
      // hide the not-yet-closed '**' markers while streaming
      let disp = full;
      if ((disp.match(/\*\*/g) || []).length % 2) {
        const i = disp.lastIndexOf('**');
        disp = disp.slice(0, i) + disp.slice(i + 2);
      }
      contentEl.innerHTML = MD.render(disp) + '<span class="cursor-blink"></span>';
      if (this.nearBottom()) this.scrollDown(false);
    };

    try {
      await AI.generate({
        messages: history,
        signal: this.abortCtl.signal,
        search: wasSearch || forceSearch,
        onMeta: (t, data) => {
          if (t === 'imageStart') {
            const b = node.querySelector('.nm-badge');
            if (b) b.textContent = I18N.lang === 'fa' ? '🎨 در حال کشیدن…' : '🎨 Painting…';
          } else if (t === 'imageFail') {
            this.toast(I18N.lang === 'fa' ? 'ساخت عکس ناموفق بود 😔' : 'Image failed 😔', 'err');
          } else if (t === 'web') {
            const b = node.querySelector('.nm-badge');
            if (b) b.textContent = I18N.lang === 'fa' ? 'جست‌وجوی وب' : 'Web search';
            // browser-style results panel (Google-like) above the answer
            if (Array.isArray(data) && data.length) {
              const resultsMode = wasSearch || forceSearch;
              const panel = document.createElement('div');
              panel.className = 'sources' + (resultsMode ? ' results' : '');
              const items = data.slice(0, resultsMode ? 7 : 5).map((r, i) => {
                let host = '';
                try { host = new URL(r.url).hostname.replace(/^www\./, ''); } catch (e) { host = ''; }
                return '<a class="src" href="' + MD.esc(r.url) + '" target="_blank" rel="noopener noreferrer">' +
                  '<span class="src-n">' + (i + 1) + '</span>' +
                  '<span class="src-body"><span class="src-u">' + MD.esc(host) + '</span>' +
                  '<span class="src-t">' + MD.esc(r.title) + '</span>' +
                  (r.snippet ? '<span class="src-s">' + MD.esc(r.snippet.slice(0, 160)) + '</span>' : '') +
                  '</span></a>';
              }).join('');
              panel.innerHTML = '<div class="sources-head">🌐 ' + MD.esc(I18N.t('webSources')) + '</div>' + items;
              // results open INSIDE the built-in browser
              panel.addEventListener('click', e => {
                const a = e.target.closest('a.src');
                if (!a) return;
                e.preventDefault();
                this.openUrl(a.getAttribute('href'));
              });
              node.querySelector('.msg-body').insertBefore(panel, contentEl);
            }
          } else if (t === 'searchFail') {
            this.toast(I18N.t('searchFail'), 'err');
          }
        },
        onChunk: (piece, all) => { full = all; paint(false); }
      });

      contentEl.innerHTML = MD.render(full);
      Store.addMessage(chatId, { role: 'assistant', content: full });
      this.renderChatList();
      if (this.settings.tts) this.speak(full);

    } catch (err) {
      if (err && err.name === 'AbortError') {
        if (full) {
          contentEl.innerHTML = MD.render(full);
          Store.addMessage(chatId, { role: 'assistant', content: full });
        } else node.remove();
      } else {
        const msg = (err && err.message) || I18N.t('errorMessage');
        contentEl.innerHTML = MD.render('⚠️ ' + msg);
      }
    } finally {
      if (full && !node.querySelector('.msg-actions')) {
        const acts = document.createElement('div');
        acts.className = 'msg-actions';
        acts.innerHTML =
          '<button class="ma-btn" data-act="copy" title="copy">' + ICONS.copy + '</button>' +
          '<button class="ma-btn" data-act="listen" title="listen">' + ICONS.listen + '</button>' +
          '<button class="ma-btn" data-act="regen" title="regen">' + ICONS.regen + '</button>';
        acts.addEventListener('click', e => {
          const b = e.target.closest('.ma-btn');
          if (!b) return;
          if (b.dataset.act === 'copy') this.copyText(full, b);
          if (b.dataset.act === 'listen') this.speak(full);
          if (b.dataset.act === 'regen') this.regenerate();
        });
        node.querySelector('.msg-body').appendChild(acts);
      }
      this.generating = false;
      this.abortCtl = null;
      this.setStopUI(false);
    }
  },

  async regenerate() {
    if (this.generating) return;
    const chat = Store.getChat(this.activeId);
    if (!chat) return;
    while (chat.messages.length && chat.messages[chat.messages.length - 1].role === 'assistant') {
      chat.messages.pop();
    }
    Store.updateChat(this.activeId, { messages: chat.messages });
    this.renderMessages(chat.messages);
    this.generate();
  },

  setStopUI(on) {
    $('#sendBtn').classList.toggle('stop', on);
    $('#micBtn').disabled = on;
  },

  /* ---------------- speech (TTS) ---------------- */
  speak(text) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(/[#*`>|]/g, '').slice(0, 600));
    u.lang = I18N.lang === 'zh-TW' ? 'zh-TW' : I18N.lang;
    speechSynthesis.speak(u);
  },

  /* ---------------- voice input (STT) ---------------- */
  stopVoice(save) {
    if (!this.voiceActive) return;
    this.voiceActive = false;
    clearInterval(this.voiceTimer);
    const transcript = (this.voiceFinal + ' ' + ($('#voiceText').dataset.interim || '')).trim();
    try { this.recognition && this.recognition.stop(); } catch (e) {}
    $('#voiceBar').hidden = true;
    $('#micBtn').classList.remove('rec');
    if (save && transcript) {
      const input = $('#input');
      input.value = (input.value ? input.value + ' ' : '') + transcript;
      input.focus();
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 180) + 'px';
    }
    this.voiceFinal = '';
    $('#voiceText').textContent = '';
    $('#voiceText').dataset.interim = '';
  },

  startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { this.toast(I18N.t('micNoSupport'), 'err'); return; }
    if (this.voiceActive) { this.stopVoice(true); return; }

    this.recognition = new SR();
    const r = this.recognition;
    r.lang = this.voiceLocale();
    r.continuous = true;
    r.interimResults = true;

    this.voiceActive = true;
    this.voiceFinal = '';
    this.voiceSeconds = 0;
    $('#voiceText').textContent = '';
    $('#voiceText').dataset.interim = '';
    $('#voiceTimer').textContent = '0:00';
    $('#voiceHint').textContent = I18N.t('voiceHint');
    $('#voiceBar').hidden = false;
    $('#micBtn').classList.add('rec');

    this.voiceTimer = setInterval(() => {
      this.voiceSeconds++;
      $('#voiceTimer').textContent = Math.floor(this.voiceSeconds / 60) + ':' + String(this.voiceSeconds % 60).padStart(2, '0');
    }, 1000);

    r.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) this.voiceFinal += t + ' ';
        else interim += t;
      }
      const vt = $('#voiceText');
      vt.textContent = (this.voiceFinal + interim).trim();
      vt.dataset.interim = interim;
    };
    r.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.toast(I18N.t('micNoSupport'), 'err');
        this.stopVoice(false);
      }
    };
    r.onend = () => {
      // keep listening until user stops (Chrome cuts off after silence)
      if (this.voiceActive) { try { r.start(); } catch (e) {} }
    };

    try { r.start(); } catch (e) { this.stopVoice(false); }
  },

  /* ---------------- sidebar mobile ---------------- */
  openSidebar() { $('#sidebar').classList.add('open'); $('#sidebarBackdrop').classList.add('show'); },
  closeSidebar() { $('#sidebar').classList.remove('open'); $('#sidebarBackdrop').classList.remove('show'); },

  /* ---------------- settings ---------------- */
  VOICE_LANGS: [
    ['fa-IR', 'فارسی (ایران)'],
    ['en-US', 'English (US)'],
    ['en-GB', 'English (UK)'],
    ['ar-SA', 'العربية'],
    ['tr-TR', 'Türkçe'],
    ['az-AZ', 'Azərbaycanca'],
    ['ur-PK', 'اردو'],
    ['de-DE', 'Deutsch'],
    ['fr-FR', 'Français'],
    ['es-ES', 'Español'],
    ['it-IT', 'Italiano'],
    ['pt-BR', 'Português (BR)'],
    ['ru-RU', 'Русский'],
    ['hi-IN', 'हिन्दी'],
    ['zh-CN', '中文（简体）'],
    ['ja-JP', '日本語'],
    ['ko-KR', '한국어']
  ],

  buildLangSelect() {
    const sel = $('#langSelect');
    sel.innerHTML = '<option value="auto">🌐 Auto</option>';
    for (const code in I18N.LANGS) {
      const o = document.createElement('option');
      o.value = code;
      o.textContent = I18N.LANGS[code].native;
      sel.appendChild(o);
    }
    sel.value = this.settings.lang || 'auto';

    const vs = $('#voiceLangSelect');
    vs.innerHTML = '<option value="auto">' + I18N.t('autoVoice') + '</option>';
    for (const [code, label] of this.VOICE_LANGS) {
      const o = document.createElement('option');
      o.value = code;
      o.textContent = label;
      vs.appendChild(o);
    }
    vs.value = this.settings.voiceLang || 'auto';
  },

  /* resolve the speech-recognition locale */
  voiceLocale() {
    const v = this.settings.voiceLang || 'auto';
    if (v !== 'auto') return v;
    const map = { fa: 'fa-IR', ar: 'ar-SA', ur: 'ur-PK', ps: 'fa-AF', ku: 'ku-TR', tr: 'tr-TR', az: 'az-AZ', he: 'he-IL' };
    return map[I18N.lang] || (navigator.language || 'en-US');
  },

  fillSettingsUI() {
    $('#userNameInput').value = this.settings.userName || '';
    $('#providerSelect').value = this.settings.provider || 'aio-free';
    $('#apiKeyInput').value = this.settings.apiKey || '';
    $('#modelInput').value = this.settings.model || '';
    $('#baseUrlInput').value = this.settings.baseUrl || '';
    $('#voiceLangSelect').value = this.settings.voiceLang || 'auto';
    this.syncProviderFields();
    $$('#themeSeg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.val === this.settings.theme));
    $$('#accentRow .acc').forEach(b => b.classList.toggle('active', b.dataset.acc === this.settings.accent));
    $('#audioToggle').classList.toggle('on', !!this.settings.tts);
  },

  syncProviderFields() {
    const p = $('#providerSelect').value;
    const conf = AI.PROVIDERS[p];
    $('#apiFields').hidden = p === 'demo' || (conf && conf.noKey);
    $('#baseUrlField').hidden = p !== 'custom';
    if (conf) $('#modelInput').placeholder = conf.model;
    const live = p !== 'demo' && (!conf || conf.noKey || !!$('#apiKeyInput').value.trim());
    $('#aiStatus').classList.toggle('live', live);
    $('#aiStatusText').textContent = live
      ? (p === 'aio-free' ? 'Aio' : p) + (p === 'aio-free' ? '' : ' · ' + ($('#modelInput').value.trim() || (conf && conf.model) || ''))
      : I18N.t('providerDemo');
  },

  openSettings(tab) {
    $('#settingsModal').hidden = false;
    if (tab) this.switchTab(tab);
  },

  switchTab(name) {
    $$('.m-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    $$('.m-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === name));
  },

  saveSettings() {
    const patch = {
      userName: $('#userNameInput').value.trim(),
      lang: $('#langSelect').value,
      theme: this.settings.theme,
      accent: this.settings.accent,
      provider: $('#providerSelect').value,
      apiKey: $('#apiKeyInput').value.trim(),
      model: $('#modelInput').value.trim(),
      baseUrl: $('#baseUrlInput').value.trim(),
      voiceLang: $('#voiceLangSelect').value
    };
    this.settings = Store.saveSettings(patch);

    I18N.init(this.settings.lang);
    this.applyTheme();
    this.applyAccent();
    I18N.apply();
    this.updateWelcome();
    this.updateProfileUI();
    this.updateBadge();
    this.renderChatList();
    if (this.activeId) { const c = Store.getChat(this.activeId); if (c) this.renderMessages(c.messages); }
    $('#settingsModal').hidden = true;
    this.toast(I18N.t('savedToast'), 'ok');
  },

  changePhoto() {
    const inp = $('#photoInput');
    inp.value = '';
    inp.click();
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        const img = new Image();
        img.onload = () => {
          const S = 256;
          const cv = document.createElement('canvas');
          cv.width = cv.height = S;
          const ctx = cv.getContext('2d');
          const mn = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width - mn) / 2, (img.height - mn) / 2, mn, mn, 0, 0, S, S);
          this.settings = Store.saveSettings({ userPhoto: cv.toDataURL('image/jpeg', 0.85) });
          this.updateProfileUI();
          this.toast(I18N.t('savedToast'), 'ok');
        };
        img.src = rd.result;
      };
      rd.readAsDataURL(f);
    };
  },

  removePhoto() {
    this.settings = Store.saveSettings({ userPhoto: '' });
    this.updateProfileUI();
  },

  /* ---------------- install ---------------- */
  initInstall() {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      this.deferredInstall = e;
      $('#installBtn').hidden = false;
    });
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (ios && !standalone) $('#installBtn').hidden = false;
  },

  async install() {
    if (this.deferredInstall) {
      this.deferredInstall.prompt();
      const r = await this.deferredInstall.userChoice.catch(() => null);
      if (r && r.outcome === 'accepted') $('#installBtn').hidden = true;
      this.deferredInstall = null;
      return;
    }
    this.openSettings('about');
  },

  /* ---------------- events ---------------- */
  bindEvents() {
    $('#newChatBtn').addEventListener('click', () => {
      this.activeId = null;
      this.showWelcome();
      this.renderChatList();
      this.closeSidebar();
      $('#input').focus();
    });

    $('#searchChats').addEventListener('input', () => this.renderChatList());
    $('#menuBtn').addEventListener('click', () => this.openSidebar());
    $('#closeSidebar').addEventListener('click', () => this.closeSidebar());
    $('#sidebarBackdrop').addEventListener('click', () => this.closeSidebar());
    $('#logoBtn').addEventListener('click', () => { this.activeId = null; this.showWelcome(); this.renderChatList(); this.closeSidebar(); });

    // search-home: big search box + quick tags
    const homeGo = () => {
      const v = $('#homeInput').value.trim();
      if (!v || this.generating) return;
      $('#homeInput').value = '';
      this.send(v, { forceSearch: true });
    };
    $('#homeSearch').addEventListener('submit', e => { e.preventDefault(); homeGo(); });
    $$('.h-tag').forEach(t => t.addEventListener('click', () => this.send(t.dataset.q, { forceSearch: true })));

    const input = $('#input');
    $('#sendBtn').addEventListener('click', () => {
      if (this.generating) { if (this.abortCtl) this.abortCtl.abort(); return; }
      this.send(input.value);
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!this.generating) this.send(input.value); }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 180) + 'px';
    });

    $('#micBtn').addEventListener('click', () => this.startVoice());
    $('#voiceDone').addEventListener('click', () => this.stopVoice(true));
    $('#voiceCancel').addEventListener('click', () => this.stopVoice(false));

    $('#searchToggle').addEventListener('click', () => {
      this.searchMode = !this.searchMode;
      $('#searchToggle').classList.toggle('on', this.searchMode);
      this.toast(this.searchMode ? (I18N.lang === 'fa' ? 'جست‌وجوی وب روشن شد 🌐' : 'Web search ON 🌐')
                                 : (I18N.lang === 'fa' ? 'جست‌وجوی وب خاموش شد' : 'Web search OFF'));
    });

    $('#themeToggle').addEventListener('click', () => {
      this.settings = Store.saveSettings({ theme: this.settings.theme === 'dark' ? 'light' : 'dark' });
      this.applyTheme();
      $$('#themeSeg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.val === this.settings.theme));
    });

    $('#audioToggle').addEventListener('click', () => {
      const on = !this.settings.tts;
      this.settings = Store.saveSettings({ tts: on });
      $('#audioToggle').classList.toggle('on', on);
      if (!on && 'speechSynthesis' in window) speechSynthesis.cancel();
      else if (on) {
        const c = Store.getChat(this.activeId);
        const lastAi = c && [...c.messages].reverse().find(m => m.role === 'assistant');
        if (lastAi) this.speak(lastAi.content);
      }
    });

    $('#settingsBtn').addEventListener('click', () => this.openSettings());
    $('#profileBtn').addEventListener('click', () => { this.openSettings(); this.closeSidebar(); });
    $('#closeSettings').addEventListener('click', () => $('#settingsModal').hidden = true);
    $('#cancelSettings').addEventListener('click', () => $('#settingsModal').hidden = true);
    $('#saveSettings').addEventListener('click', () => this.saveSettings());

    $$('.m-tab').forEach(b => b.addEventListener('click', () => this.switchTab(b.dataset.tab)));
    $$('#themeSeg .seg-btn').forEach(b => b.addEventListener('click', () => {
      $$('#themeSeg .seg-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      this.settings = Store.saveSettings({ theme: b.dataset.val });
      this.applyTheme();
    }));
    $$('#accentRow .acc').forEach(b => b.addEventListener('click', () => {
      $$('#accentRow .acc').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      this.settings = Store.saveSettings({ accent: b.dataset.acc });
      this.applyAccent();
    }));

    $('#providerSelect').addEventListener('change', () => this.syncProviderFields());
    $('#apiKeyInput').addEventListener('input', () => this.syncProviderFields());
    $('#dsTest').addEventListener('click', async () => {
      if (this.settings.provider !== 'aio-free') {
        this.toast(I18N.lang === 'fa' ? 'تست اتصال برای حالت Aio Free است' : 'Connection test applies to Aio Free mode');
        return;
      }
      const ok = await AI.ensurePuter();
      if (!ok) { this.toast(I18N.lang === 'fa' ? 'Puter در دسترس نیست' : 'Puter unavailable', 'err'); return; }
      try {
        const signed = await window.puter.auth.isSignedIn();
        if (!signed) { this.showConnectBanner(); return; }
        AI.puterDeadUntil = 0;
        this.pingDeepseek();
      } catch (e) {}
    });
    $('#eyeBtn').addEventListener('click', () => {
      const inp = $('#apiKeyInput'), btn = $('#eyeBtn');
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      btn.classList.toggle('showing', show);
    });
    $('#changePhotoBtn').addEventListener('click', () => this.changePhoto());
    $('#removePhotoBtn').addEventListener('click', () => this.removePhoto());
    $('#clearDataBtn').addEventListener('click', async () => {
      if (!await this.confirmAsk(I18N.t('clearDataConfirm'))) return;
      Store.clearAllChats();
      this.activeId = null;
      this.showWelcome();
      this.renderChatList();
      this.toast(I18N.t('clearDone'), 'ok');
    });

    $('#installBtn').addEventListener('click', () => this.install());

    // copy + run buttons inside code blocks
    document.addEventListener('click', e => {
      const run = e.target.closest('.cb-run');
      if (run) {
        const code = window.__codeRegistry[+run.dataset.code] || '';
        // render the generated webpage LIVE in the built-in browser
        this.showBrowser();
        $('#bvUrl').value = 'preview://aio-generated-page';
        $('#bvUrl').dataset.url = '';
        const page = $('#bvPage');
        page.innerHTML = '';
        const frame = document.createElement('iframe');
        frame.className = 'bv-frame';
        frame.srcdoc = code;
        page.appendChild(frame);
        return;
      }
      const b = e.target.closest('.cb-copy');
      if (!b) return;
      const raw = window.__codeRegistry[+b.dataset.code] || '';
      navigator.clipboard && navigator.clipboard.writeText(raw).catch(() => {});
      const use = b.querySelector('use');
      if (use) {
        use.setAttribute('href', '#i-check');
        setTimeout(() => use.setAttribute('href', '#i-copy'), 1400);
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (this.voiceActive) this.stopVoice(false);
        $('#settingsModal').hidden = true;
        $('#confirmModal').hidden = true;
      }
    });

    this.initInstall();
    this.initBrowser();
  },

  /* ---------------- browser mode ---------------- */
  initBrowser() {
    $('#bvForm').addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#bvUrl').value.trim();
      if (!v) return;
      if (/^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}([\/?#]\S*)?$/i.test(v)) this.openUrl(v);
      else { this.showChat(); this.send(v, { forceSearch: true }); }
    });
    $('#bvBack').addEventListener('click', () => this.showChat());
    $('#bvExternal').addEventListener('click', () => {
      const u = $('#bvUrl').dataset.url || $('#bvUrl').value;
      if (u) window.open(u, '_blank', 'noopener');
    });
    // links inside a rendered page open INSIDE the browser view
    $('#bvPage').addEventListener('click', e => {
      const a = e.target.closest('a[href]');
      if (!a) return;
      e.preventDefault();
      const href = a.getAttribute('href');
      if (href && href.startsWith('http')) this.openUrl(href);
    });
    $('#browserBtn').addEventListener('click', () => {
      if ($('#browserView').hidden) this.showBrowser();
      else this.showChat();
    });
  },

  showBrowser() {
    $('#messages').style.display = 'none';
    $('#composer').style.display = 'none';
    $('#browserView').hidden = false;
    if (!$('#bvPage').innerHTML.trim()) {
      $('#bvPage').innerHTML = '<div class="bv-empty">' +
        (I18N.lang === 'fa' ? 'یه آدرس بنویس یا چیزی جست‌وجو کن 🔍' : 'Type an address or search 🔍') +
        '</div>';
    }
    $('#bvUrl').focus();
  },

  showChat() {
    $('#messages').style.display = '';
    $('#composer').style.display = '';
    $('#browserView').hidden = true;
  },

  normalizeUrl(v) {
    return /^https?:\/\//i.test(v) ? v : 'https://' + v;
  },

  async openUrl(url) {
    url = this.normalizeUrl(url);
    $('#messages').style.display = 'none';
    $('#composer').style.display = 'none';
    $('#browserView').hidden = false;
    const bar = $('#bvUrl');
    bar.value = url;
    bar.dataset.url = url;
    const page = $('#bvPage');
    const status = $('#bvStatus');
    page.innerHTML = '';
    status.hidden = false;

    const finish = () => { status.hidden = true; };
    const fail = () => {
      finish();
      page.innerHTML = '<div class="bv-fail">😕 ' +
        (I18N.lang === 'fa'
          ? 'این صفحه توی مرورگر داخلی باز نشد.<br>با دکمه ↗ بالا می‌تونی توی مرورگر سیستمت بازش کنی.'
          : 'This page could not be opened in the built-in browser.<br>Use the ↗ button above to open it in your system browser.') +
        '</div>';
    };

    // 1) Puter server-side fetch (full HTML, bypasses CORS)
    if (window.puter && window.puter.net && window.puter.net.fetch && location.protocol !== 'file:') {
      try {
        const r = await Promise.race([
          window.puter.net.fetch(url),
          AI.sleep(9000).then(() => ({ __t: true }))
        ]);
        if (r && !r.__t && !r.error) {
          const html = await r.text();
          if (html && html.length > 400) {
            page.appendChild(this.renderReaderHTML(html, url));
            finish();
            return;
          }
        }
      } catch (e) { /* fall through */ }
    }

    // 2) Jina reader (clean markdown of the page)
    try {
      const r2 = await this.fetchWithTimeout('https://r.jina.ai/' + url, 15000, null);
      if (r2.ok) {
        const txt = await r2.text();
        if (txt && txt.length > 200) {
          page.innerHTML = MD.render(txt.slice(0, 40000));
          finish();
          return;
        }
      }
    } catch (e) { /* fall through */ }

    fail();
  },

  /* sanitize remote HTML into a clean reader article */
  renderReaderHTML(html, base) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,noscript,iframe,object,embed,svg,form,button,input,select,textarea,nav,header,footer,aside,link,meta').forEach(n => n.remove());
    const allowed = new Set(['P','H1','H2','H3','H4','H5','H6','UL','OL','LI','IMG','A','STRONG','EM','B','I','BLOCKQUOTE','PRE','CODE','TABLE','THEAD','TBODY','TR','TD','TH','BR','HR','FIGURE','FIGCAPTION','ARTICLE','MAIN','SECTION','DIV','SPAN','CAPTION','DEL','SUP','SUB']);
    const abs = v => { try { return new URL(v, base).href; } catch (e) { return v; } };

    const build = (node, depth) => {
      if (depth > 16) return null;
      if (node.nodeType === 3) return document.createTextNode(node.nodeValue);
      if (node.nodeType !== 1 || !allowed.has(node.tagName)) return null;
      const el = document.createElement(node.tagName);
      if (node.tagName === 'IMG') {
        const s = node.getAttribute('src') || node.getAttribute('data-src') || '';
        if (!s || /^data:/i.test(s)) return null;
        el.src = abs(s); el.loading = 'lazy'; el.alt = node.alt || '';
        return el;
      }
      if (node.tagName === 'A') {
        const h = node.getAttribute('href') || '';
        if (!h || h.startsWith('#') || h.startsWith('javascript:')) return document.createTextNode(node.textContent);
        el.href = abs(h);
      }
      let kids = 0;
      for (const c of Array.from(node.childNodes)) {
        const out = build(c, depth + 1);
        if (out) { el.appendChild(out); kids++; }
        if (kids > 500) break;
      }
      return kids ? el : (node.tagName === 'BR' ? document.createElement('br') : null);
    };

    const frag = document.createDocumentFragment();
    for (const c of Array.from(doc.body.childNodes)) {
      const out = build(c, 0);
      if (out) frag.appendChild(out);
    }
    const wrap = document.createElement('div');
    wrap.className = 'bv-article';
    wrap.appendChild(frag);
    // page title heading if the article lacks one
    if (!wrap.querySelector('h1,h2') && doc.title) {
      const h = document.createElement('h1');
      h.textContent = doc.title;
      wrap.insertBefore(h, wrap.firstChild);
    }
    return wrap;
  },

  /* fetch helper with hard timeout */
  async fetchWithTimeout(url, ms, signal) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    if (signal) signal.addEventListener('abort', () => ctl.abort(), { once: true });
    try { return await fetch(url, { signal: ctl.signal }); }
    finally { clearTimeout(t); }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());

/* when a new service worker takes over, reload once so users always get the latest version */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data && e.data.type === 'SW_UPDATED' && !sessionStorage.getItem('aioSwReloaded')) {
      sessionStorage.setItem('aioSwReloaded', '1');
      location.reload();
    }
  });
}
