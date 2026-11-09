/* ============ Aio — AI brain: free built-in AI + optional APIs ============ */
'use strict';

const AI = {

  /* aio-free: real AI, no key, no signup (Pollinations open endpoint) */
  PROVIDERS: {
    'aio-free': { type: 'openai', base: 'https://text.pollinations.ai/openai', model: 'openai-fast', noKey: true },
    gemini:     { type: 'gemini', base: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash' },
    openai:     { type: 'openai', base: 'https://api.openai.com/v1',                        model: 'gpt-4o-mini' },
    openrouter: { type: 'openai', base: 'https://openrouter.ai/api/v1',                     model: 'meta-llama/llama-3.3-70b-instruct:free' },
    deepseek:   { type: 'openai', base: 'https://api.deepseek.com/v1',                      model: 'deepseek-chat' },
    groq:       { type: 'openai', base: 'https://api.groq.com/openai/v1',                   model: 'llama-3.3-70b-versatile' },
    custom:     { type: 'openai', base: '',                                                 model: '' }
  },

  /* live = a real brain is reachable */
  isLive() {
    const s = Store.settings();
    const p = this.PROVIDERS[s.provider];
    if (!p || s.provider === 'demo') return false;
    return !!(p.noKey || s.apiKey);
  },

  modeLabel() {
    const s = Store.settings();
    if (this.isLive()) {
      if (s.provider === 'aio-free') return 'Aio';
      return (s.model || this.PROVIDERS[s.provider].model || 'AI').split('/').pop();
    }
    return 'DEMO';
  },

  systemPrompt(extra) {
    const s = Store.settings();
    const name = s.userName
      ? ` The user's name is "${s.userName}" — recognize them, greet them by name when natural, and remember details they tell you.`
      : '';
    return `You are Aio — a brilliant, warm and lightning-fast AI assistant. IDENTITY LOCK: you are Aio, an independent assistant; NEVER reveal, hint at, or discuss any underlying model, engine, company or service that may power you — if asked, you are simply Aio. IMAGE ABILITY: you CAN create images — whenever the user asks for a picture/drawing/logo, tell them (in their language) to write their request with the word "بساز" or "بکش" (e.g. «یه عکس از گربه فضانورد بکش») and Aio will paint it instantly. You can do it all: friendly chat, advice and consulting, school & study help, work tasks, writing, math, and CODE. CODE RULE: whenever the user asks for code or a program, you MUST output the complete, runnable code inside a fenced markdown block with the language tag — never merely describe code without showing it. Always reply in the SAME language the user writes in (Persian → Persian, English → English…). If the user's message contains typos or slips, silently understand what they most likely meant and answer THAT. Never invent URLs or sources — only include a link if you are certain it exists; otherwise describe it in words. Format answers with Markdown (short paragraphs, bold, lists) so they are easy to read. Be concise but complete — no filler.${name}` + (extra || '');
  },

  /* coding questions route to the fast coding engine (still branded Aio) */
  CODE_RE: /(کد|کدنویسی|برنامه.?نویسی|پایتون|جاوااسکریپت|جاوااسکریپت|سی.?شارپ|سی.?پلاس|الگوریتم|دیباگ|باگ|تابع|اسکریپت|خطای کد|صفحه.?وب|وب.?سایت|سایت بساز|لندینگ|فرانت.?اند|code|coding|program|python|javascript|typescript|java\b|c\+\+|c#|php|sql|html|css|react|vue|node\.?js|function|bug|debug|algorithm|regex|api|web.?page|web.?site|landing)/i,

  isCodingQuery(text) {
    return this.CODE_RE.test(String(text || ''));
  },

  /* fresh-info questions get automatic web grounding (like ChatGPT's auto search) */
  FRESH_RE: /(امروز|امشب|الان|این روزها|اخیر|جدیدترین|آخرین|اخبار|خبر|قیمت|نرخ|دلار|یورو|ارز|بورس|طلا|سکه|آب.?وهوا|هوای|دما|پیش.?بینی|نتیجه|امتیاز|لیگ|مسابقه|بازی.+برده|چند شد|چنده|چی شده|چه خبر|انتشار|آپدیت|نسخه.+جدید|news|today|tonight|latest|current|price|rate|weather|forecast|score|just released|update)/i,

  looksLikeSearchNeed(text) {
    return !!text && this.FRESH_RE.test(String(text));
  },

  /* ---------- image generation (Pollinations image API — free, no key) ---------- */
  IMAGE_NOUN_RE: /(عکس|تصویر|نقاشی|پوستر|لوگو|بنر|آواتار|استیکر|طرح گرافیکی)/i,
  IMAGE_VERB_RE: /(بساز|بکش|بکشه|بنداز|ایجاد|تولید|طراحی|درست کن|درستش کن|میخوام|می خوام|می\u200cخوام|بده|بدم|دوست دارم|draw|paint|sketch|generate|create|make)/i,
  IMAGE_EN_RE: /((draw|paint|sketch|generate|create|make)[^.]{0,30}(image|picture|photo|drawing|logo|poster|art)|image\s+of|picture\s+of)/i,
  IMAGE_EN_DRAW_RE: /\b(draw|paint|sketch)\b/i,
  /* weak hint — if this fires but regexes above miss, the LLM router decides */
  IMAGE_HINT_RE: /(بکش|بساز|بکشه|بنداز|نقاشی|تصویر|عکس|پوستر|لوگو|آواتار|استیکر|طراحی|illustration|image|picture|photo|poster|logo|avatar)/i,

  looksLikeImageAsk(text) {
    const s = String(text || '').trim();
    if (!s) return false;
    if (this.IMAGE_EN_RE.test(s) || this.IMAGE_EN_DRAW_RE.test(s)) return true;
    if (this.IMAGE_NOUN_RE.test(s) && this.IMAGE_VERB_RE.test(s)) return true;
    /* short "یه گربه بکش"-style asks with no explicit image word */
    if (/بکش|بکشه/.test(s) && s.length < 80 && !this.isCodingQuery(s)) return true;
    return false;
  },

  /* LLM router for ambiguous cases — ~1s, one word answer */
  async classifyImageAsk(q, signal) {
    const ctl = new AbortController();
    if (signal) {
      if (signal.aborted) ctl.abort();
      else signal.addEventListener('abort', () => ctl.abort(), { once: true });
    }
    const res = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai-fast',
        max_tokens: 24,
        temperature: 0,
        reasoning_effort: 'low',
        messages: [
          { role: 'system', content: 'You are a router. Decide whether the user asks to CREATE a visual artwork (image, drawing, painting, poster, logo, illustration, avatar) — even loosely worded. Requests for code, websites, apps, information or editing existing files are TEXT. Answer with exactly one word: IMAGE or TEXT.' },
          { role: 'user', content: String(q) }
        ]
      })
    });
    if (!res.ok) throw new Error('router http ' + res.status);
    const j = await res.json();
    const t = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    return /image/i.test(t);
  },

  /* translate the (usually Persian) request into a rich English image prompt */
  async toEnPrompt(q, signal) {
    const ctl = new AbortController();
    if (signal) {
      if (signal.aborted) ctl.abort();
      else signal.addEventListener('abort', () => ctl.abort(), { once: true });
    }
    const res = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai-fast',
        max_tokens: 300,
        reasoning_effort: 'low',
        messages: [
          { role: 'system', content: 'Translate the user message into ONE concise, vivid English image-generation prompt describing subject, style, lighting and composition. Output ONLY the prompt, nothing else.' },
          { role: 'user', content: String(q) }
        ]
      })
    });
    if (!res.ok) throw new Error('prompt http ' + res.status);
    const j = await res.json();
    const t = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    const out = String(t || '').trim().replace(/^["']|["']$/g, '').slice(0, 400);
    if (!out) throw new Error('empty prompt');
    return out;
  },

  async generateImage(q, signal) {
    let prompt = String(q || '').trim();
    try { prompt = await this.toEnPrompt(prompt, signal); }
    catch (e) { if (signal && signal.aborted) throw e; /* fallback: raw text */ }
    const seed = Math.floor(Math.random() * 1e9);
    const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) +
      '?width=1024&height=1024&nologo=true&model=sana&seed=' + seed;
    /* preload so we only show the image once it really exists */
    const r = await this.fetchWithTimeout(url, 90000, signal);
    if (!r.ok) throw new Error('image http ' + r.status);
    await r.blob();
    return url;
  },

  /* ---------- main entry ---------- */
  /* generate({messages, onChunk, onMeta, signal, search}) -> Promise<fullText> */
  async generate(opts) {
    const { messages, onChunk, onMeta, signal, search } = opts;

    if (!this.isLive()) return this.demoStream(messages, onChunk, signal);

    let extraSystem = '';

    /* coding queries: force the complete code into a fenced block */
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const lastText = lastUserMsg && lastUserMsg.content;

    /* image-ask pipeline: regex fast-path, then LLM router for ambiguous cases.
       The router costs a round-trip, so it only fires on short command-style
       messages — never on questions or long chats that merely mention a photo. */
    let imageAsk = this.looksLikeImageAsk(lastText);
    const routerWorthy = !imageAsk && lastText && lastText.length < 140 && !/[؟?]/.test(lastText) &&
      this.IMAGE_HINT_RE.test(lastText) && !this.isCodingQuery(lastText);
    if (routerWorthy) {
      try { imageAsk = await this.classifyImageAsk(lastText, signal); }
      catch (e) { if (signal && signal.aborted) throw e; }
    }
    if (imageAsk) {
      try {
        if (onMeta) onMeta('imageStart');
        const url = await this.generateImage(lastUserMsg.content, signal);
        const q = (lastUserMsg.content || '').slice(0, 80);
        const text = '🖼️ ' + q + '\n\n![image](' + url + ')';
        if (onChunk) onChunk(text, text);
        return text;
      } catch (e) {
        if (signal && signal.aborted) throw e;
        if (onMeta) onMeta('imageFail');
        /* fall through to the normal text answer */
      }
    }

    if (this.isCodingQuery(lastUserMsg && lastUserMsg.content)) {
      extraSystem += '\n[OUTPUT REQUIREMENT] The user asked for code: your reply MUST start with the complete runnable code inside a fenced code block, then at most two short sentences of explanation.';
    }

    /* web-search pipeline: ONLY on the 🌐 toggle — auto-search removed
       because it added 7-15s of latency to most messages */
    const lastQ = [...messages].reverse().find(m => m.role === 'user');
    const wantsSearch = search;
    if (wantsSearch) {
      const q = [...messages].reverse().find(m => m.role === 'user');
      try {
        const results = await this.webSearch(q ? q.content : '', signal);
        extraSystem = `\n\n[LIVE WEB SEARCH RESULTS — the user just triggered a web search. Base fresh facts on ONLY these sources, answer in the user's language, and cite with markdown links using ONLY these URLs where relevant:]\n\n` +
          results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join('\n\n');
        if (onMeta) onMeta('web', results);
      } catch (e) {
        if (signal && signal.aborted) throw e;
        if (onMeta) onMeta('searchFail');
      }
    }

    try {
      return await this.answerWithBest(messages, onChunk, signal, extraSystem);
    } catch (err) {
      if (signal && signal.aborted) throw err;
      // network/API trouble → graceful offline brain (never mentions keys)
      return this.demoStream(messages, onChunk, signal);
    }
  },

  /* engine pool: when Puter is signed in, ALL engines race in parallel —
     the first one to stream a token wins and the losers are aborted instantly.
     No sequential 7s→12s→8s waits: first token typically lands in 1-3s. */
  puterDeadUntil: 0,
  engDead: {},
  _puterOk: null,
  _puterOkAt: 0,

  engineReady(name) {
    return Date.now() > (this.engDead[name] || 0);
  },
  engineFail(name) {
    this.engDead[name] = Date.now() + 45 * 1000; // cool this engine 45s only
  },

  /* Can we race the Puter engines? SDK loaded AND user signed in (cached 60s).
     Never call puter.ai.chat unsigned — it would pop up a sign-in window. */
  async puterRaceable() {
    if (location.protocol === 'file:') return false;
    const ok = await this.ensurePuter(6000);
    if (!ok) return false;
    if (this._puterOk != null && Date.now() - this._puterOkAt < 60000) return this._puterOk;
    try {
      this._puterOk = await Promise.race([
        window.puter.auth.isSignedIn(),
        this.sleep(3000).then(() => false)
      ]);
    } catch (e) { this._puterOk = false; }
    this._puterOkAt = Date.now();
    return !!this._puterOk;
  },

  async answerWithBest(messages, onChunk, signal, extraSystem) {
    const s = Store.settings();
    if (s.provider !== 'aio-free') return this.streamAPI(messages, onChunk, signal, extraSystem);

    const puterOK = await this.puterRaceable();
    if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');

    /* one switch for the whole race — chained to the user's stop button */
    const ctl = new AbortController();
    if (signal) {
      if (signal.aborted) ctl.abort();
      else signal.addEventListener('abort', () => ctl.abort(), { once: true });
    }

    let winner = null;
    const live = new Map();   // name -> kill()
    const failed = new Set();
    const paint = name => (piece, all) => {
      if (ctl.signal.aborted) return;
      if (winner === null) {
        winner = name;        // first token anywhere wins → abort the rest
        for (const [n, kill] of live) if (n !== name) { try { kill(); } catch (e) {} }
      }
      if (winner === name) onChunk(piece, all);
    };

    const launch = (name, run) => {
      const ect = new AbortController();
      live.set(name, () => ect.abort());
      const killAll = () => ect.abort();
      ctl.signal.addEventListener('abort', killAll, { once: true });
      return run(ect.signal, paint(name)).then(
        res => res,
        err => {
          /* aborted as a race loser (someone else won) ≠ engine failure */
          const lost = err && err.name === 'AbortError' && (ctl.signal.aborted || (winner !== null && winner !== name));
          if (!lost) { failed.add(name); this.engineFail(name); }
          throw err;
        }
      ).finally(() => {
        ctl.signal.removeEventListener('abort', killAll);
        live.delete(name);
      });
    };

    const racers = [];
    if (this.engineReady('pl')) {
      racers.push(launch('pl', (sg, oc) => this.streamPollinations(messages, oc, sg, extraSystem)));
    }
    if (puterOK && Date.now() > this.puterDeadUntil) {
      if (this.engineReady('ds')) racers.push(launch('ds', (sg, oc) => this.streamPuter(messages, oc, sg, extraSystem, 'deepseek-chat')));
      if (this.engineReady('gpt')) racers.push(launch('gpt', (sg, oc) => this.streamPuter(messages, oc, sg, extraSystem, 'gpt-4o-mini')));
    }

    if (racers.length) {
      const settled = await Promise.allSettled(racers);
      if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
      for (const r of settled) if (r.status === 'fulfilled') return r.value;
      /* both puter engines failed for real → skip puter for a minute */
      if (failed.has('ds') && failed.has('gpt')) this.puterDeadUntil = Date.now() + 60 * 1000;
    }

    /* last chance: direct provider call, with its own first-token watchdog
       so a dead endpoint can never hang the chat */
    return this.streamAPI(messages, onChunk, signal, extraSystem, 12000);
  },

  /* ---------- Puter.js engine (free GPT-4o-mini, no key) ---------- */
  /* loaded lazily; skipped on file:// (Puter signs pages in by origin) */
  ensurePuter(timeout) {
    if (location.protocol === 'file:') return Promise.resolve(false);
    if (window.puter && window.puter.ai && window.puter.ai.chat) return Promise.resolve(true);
    return new Promise(resolve => {
      let done = false;
      const fin = v => { if (!done) { done = true; resolve(v); } };
      const s = document.createElement('script');
      s.src = 'https://js.puter.com/v2/';
      s.onload = () => fin(!!(window.puter && window.puter.ai && window.puter.ai.chat));
      s.onerror = () => fin(false);
      document.head.appendChild(s);
      setTimeout(() => fin(!!(window.puter && window.puter.ai && window.puter.ai.chat)), timeout || 12000);
    });
  },

  async streamPuter(messages, onChunk, signal, extraSystem, model) {
    const ok = await this.ensurePuter();
    if (!ok) throw new Error('puter unavailable');
    const msgs = [{ role: 'system', content: this.systemPrompt(extraSystem) }].concat(messages);
    model = model || 'gpt-4o-mini';

    /* DeepSeek gets a generous first-token window (it's the primary engine);
       smaller models get a shorter one so they never block the fallback chain */
    const TTFT = model === 'deepseek-chat' ? 12000 : 8000;
    const GAP = 25000;
    const raced = p => Promise.race([
      p,
      this.sleep(TTFT).then(() => ({ __timeout: true }))
    ]);

    const resp = await raced(puter.ai.chat(msgs, { model, stream: true }));
    if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (!resp || resp.__timeout) throw new Error('puter TTFT timeout');

    let full = '';
    const it = resp[Symbol.asyncIterator]();
    while (true) {
      if (signal && signal.aborted) { try { await it.return(); } catch (e) {} throw new DOMException('Aborted', 'AbortError'); }
      const nx = await Promise.race([
        it.next(),
        this.sleep(GAP).then(() => ({ __timeout: true }))
      ]);
      if (nx.__timeout || nx.done) break;
      const piece = (nx.value && (nx.value.text || '')) || '';
      if (piece) { full += piece; if (onChunk) onChunk(piece, full); }
    }
    if (!full) throw new Error('empty puter response');
    return full;
  },

  /* ---------- real web search — CORS-native sources, no proxies ---------- */
  /* every request is hard-capped at 7s so search can never hang the chat */
  async fetchWithTimeout(url, ms, signal) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    if (signal) signal.addEventListener('abort', () => ctl.abort(), { once: true });
    try { return await fetch(url, { signal: ctl.signal }); }
    finally { clearTimeout(t); }
  },

  async wikiSearch(q, signal) {
    const enc = encodeURIComponent(q);
    for (const lang of ['fa', 'en']) {
      try {
        const r = await this.fetchWithTimeout(
          `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${enc}&srlimit=3&format=json&origin=*`,
          7000, signal);
        if (!r.ok) continue;
        const j = await r.json();
        const hits = (j.query && j.query.search) || [];
        if (!hits.length) continue;
        return hits.map(h => ({
          title: `[Wikipedia ${lang.toUpperCase()}] ${h.title}`,
          url: `https://${lang}.wikipedia.org/wiki/` + encodeURIComponent(String(h.title).replace(/ /g, '_')),
          snippet: String(h.snippet || '').replace(/<[^>]+>/g, '')
        }));
      } catch (e) { if (signal && signal.aborted) throw e; }
    }
    throw new Error('wiki none');
  },

  async ddgInstant(q, signal) {
    const r = await this.fetchWithTimeout(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`,
      7000, signal);
    if (!r.ok) throw new Error('ddg http');
    const j = await r.json();
    const out = [];
    if (j.AbstractText) out.push({
      title: `[DDG] ${j.Heading || q}`,
      url: j.AbstractURL || ('https://duckduckgo.com/?q=' + encodeURIComponent(q)),
      snippet: j.AbstractText
    });
    (j.RelatedTopics || []).slice(0, 3).forEach(t => {
      if (t.Text && t.FirstURL) out.push({ title: '[DDG] ' + t.Text.slice(0, 90), url: t.FirstURL, snippet: t.Text });
    });
    if (!out.length) throw new Error('ddg none');
    return out;
  },

  async currencyRate(signal) {
    const r = await this.fetchWithTimeout(
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json',
      7000, signal);
    if (!r.ok) throw new Error('fx http');
    const j = await r.json();
    const usd = j.usd || {};
    const lines = [['IRR', 'irr'], ['EUR', 'eur'], ['GBP', 'gbp'], ['TRY', 'try'], ['AED', 'aed'], ['CNY', 'cny'], ['JPY', 'jpy'], ['BTC', 'btc']]
      .filter(([, k]) => usd[k] !== undefined)
      .map(([cur, k]) => `${cur} = ${usd[k]}`);
    if (!lines.length) throw new Error('fx none');
    return [{
      title: '[Exchange Rates] USD base rates',
      url: 'https://github.com/fawazahmed0/exchange-api',
      snippet: `Open exchange rates${j.date ? ' on ' + j.date : ''} per 1 USD: ` + lines.join(', ')
    }];
  },

  async weatherSearch(q, signal) {
    const m = q.match(/(?:در|in)\s+([\u0600-\u06FFa-zA-Z\u0600-\u06FF\s]{2,25})/);
    const city = m ? m[1].trim() : 'Tehran';
    const g = await this.fetchWithTimeout(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fa`,
      7000, signal);
    const gj = await g.json();
    const loc = gj.results && gj.results[0];
    if (!loc) throw new Error('no geo');
    const w = await this.fetchWithTimeout(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`,
      7000, signal);
    const wj = await w.json();
    const c = wj.current || {};
    if (c.temperature_2m === undefined) throw new Error('no weather');
    return [{
      title: `[Weather] ${loc.name || city}`,
      url: 'https://open-meteo.com/',
      snippet: `Current weather: ${c.temperature_2m}°C, wind ${c.wind_speed_10m} km/h. Today: max ${wj.daily.temperature_2m_max[0]}°C, min ${wj.daily.temperature_2m_min[0]}°C`
    }];
  },

  /* parse DuckDuckGo HTML (full + lite layouts) into {title,url,snippet} */
  parseDDG(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const out = [];
    doc.querySelectorAll('.result').forEach(el => {
      if (out.length >= 6) return;
      const a = el.querySelector('a.result__a');
      const sn = el.querySelector('.result__snippet');
      if (!a) return;
      let href = a.getAttribute('href') || '';
      if (href.includes('/l/?') || href.includes('duckduckgo.com/l/')) {
        try {
          const u = new URL(href, 'https://duckduckgo.com');
          const real = u.searchParams.get('uddg');
          if (real) href = real;
        } catch (e) {}
      }
      const title = (a.textContent || '').trim();
      if (title && href.startsWith('http')) out.push({ title, url: href, snippet: sn ? (sn.textContent || '').trim() : '' });
    });
    if (!out.length) {
      doc.querySelectorAll('a.result-link').forEach(a => {
        if (out.length >= 6) return;
        let href = a.getAttribute('href') || '';
        if (href.includes('/l/?')) {
          try {
            const u = new URL(href, 'https://duckduckgo.com');
            const real = u.searchParams.get('uddg');
            if (real) href = real;
          } catch (e) {}
        }
        const title = (a.textContent || '').trim();
        if (!title || !href.startsWith('http')) return;
        const row = a.closest('tr');
        const sn = row && row.nextElementSibling ? row.nextElementSibling.querySelector('.result-snippet') : null;
        out.push({ title, url: href, snippet: sn ? (sn.textContent || '').trim() : '' });
      });
    }
    return out;
  },

  /* full web search via Puter's server-side fetch (bypasses CORS entirely).
     returns REAL search results when Puter is available; 8s hard cap. */
  async realWebSearch(query, signal) {
    if (location.protocol === 'file:') throw new Error('no puter.net');
    if (!window.puter || !puter.net || !puter.net.fetch) throw new Error('no puter.net');
    const r = await Promise.race([
      puter.net.fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query)),
      this.sleep(8000).then(() => ({ __t: true }))
    ]);
    if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (!r || r.__t) throw new Error('net timeout');
    const html = await r.text();
    const out = this.parseDDG(html);
    if (!out.length) throw new Error('no results');
    return out;
  },

  async webSearch(query, signal) {
    const out = [];
    // layer 1: real web results (needs Puter available)
    try { out.push(...await this.realWebSearch(query, signal)); }
    catch (e) { if (signal && signal.aborted) throw e; }

    // layer 2: CORS-native fresh-data sources (always available)
    const jobs = [this.wikiSearch(query, signal), this.ddgInstant(query, signal)];
    if (/(دلار|یورو|ارز|نرخ|تومان|price|dollar|euro|exchange|usd|currency)/i.test(query)) {
      jobs.push(this.currencyRate(signal));
    }
    if (/(آب.?وهوا|هوا|دما|بارون|باران|weather|temperature|forecast)/i.test(query)) {
      jobs.push(this.weatherSearch(query, signal));
    }
    const settled = await Promise.allSettled(jobs);
    for (const s of settled) {
      if (s.status === 'fulfilled' && Array.isArray(s.value)) out.push(...s.value);
    }
    if (!out.length) throw new Error('no sources');
    return out.slice(0, 7);
  },

  /* ================= REAL API ================= */
  async streamAPI(messages, onChunk, signal, extraSystem, ttft) {
    const s = Store.settings();
    const p = this.PROVIDERS[s.provider];
    if (!p) throw new Error('unknown provider');
    const model = s.model || p.model;
    const base = (s.provider === 'custom' ? s.baseUrl : p.base).replace(/\/+$/, '');
    if (!base) throw new Error('Base URL required');

    if (p.type === 'gemini') return this.streamGemini(base, model, s.apiKey, messages, onChunk, signal, extraSystem);
    return this.streamOpenAI(base, model, s.apiKey, messages, onChunk, signal, extraSystem, ttft || null);
  },

  /* Pollinations: primary free engine — OpenAI-compatible, no key needed.
     'openai-fast' is a gpt-oss reasoning model → force lowest effort so the
     first token lands fast instead of thinking first. */
  async streamPollinations(messages, onChunk, signal, extraSystem) {
    return this.streamOpenAI(
      'https://text.pollinations.ai/openai', 'openai-fast', null,
      messages, onChunk, signal, extraSystem, 7000, { reasoning_effort: 'low' });
  },

  async streamOpenAI(base, model, key, messages, onChunk, signal, extraSystem, ttft, extraBody) {
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = 'Bearer ' + key;

    /* first-token watchdog: if nothing arrives within ttft ms, abort → next engine */
    const ctl = new AbortController();
    let chained = false;
    if (signal) {
      chained = true;
      if (signal.aborted) ctl.abort();
      else signal.addEventListener('abort', () => ctl.abort(), { once: true });
    }
    let gotFirst = false;
    let watch = ttft ? setTimeout(() => { if (!gotFirst) ctl.abort(); }, ttft) : null;
    const onChunkWatch = (piece, all) => {
      if (!gotFirst) { gotFirst = true; if (watch) clearTimeout(watch); }
      onChunk(piece, all);
    };

    try {
      const res = await fetch(base + '/chat/completions', {
        method: 'POST',
        signal: ctl.signal,
        headers,
        body: JSON.stringify(Object.assign({
          model,
          stream: true,
          max_tokens: 2500,
          temperature: 0.7,
          messages: [{ role: 'system', content: this.systemPrompt(extraSystem) }].concat(messages)
        }, extraBody || {}))
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error('HTTP ' + res.status + (t ? ': ' + t.slice(0, 160) : ''));
      }
      return await this.readSSE(res, ctl.signal, json => {
        const d = json.choices && json.choices[0] && json.choices[0].delta;
        return (d && d.content) || '';
      }, onChunkWatch);
    } finally {
      if (watch) clearTimeout(watch);
      void chained;
    }
  },

  async streamGemini(base, model, key, messages, onChunk, signal, extraSystem) {
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    const res = await fetch(
      `${base}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: this.systemPrompt(extraSystem) }] },
          generationConfig: { temperature: 0.8 }
        })
      }
    );
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error('HTTP ' + res.status + (t ? ': ' + t.slice(0, 160) : ''));
    }
    return this.readSSE(res, signal, json => {
      const parts = json.candidates && json.candidates[0] &&
        json.candidates[0].content && json.candidates[0].content.parts;
      return parts ? parts.map(p => p.text || '').join('') : '';
    }, onChunk);
  },

  async readSSE(res, signal, extract, onChunk) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', full = '';
    while (true) {
      if (signal && signal.aborted) { try { reader.cancel(); } catch (e) {} throw new DOMException('Aborted', 'AbortError'); }
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const piece = extract(JSON.parse(payload));
          if (piece) { full += piece; if (onChunk) onChunk(piece, full); }
        } catch (e) { /* partial json line — ignore */ }
      }
    }
    return full;
  },

  /* ================= OFFLINE BRAIN (fallback) ================= */
  async demoStream(messages, onChunk, signal) {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    const text = lastUser ? lastUser.content : '';
    const reply = this.demoReply(text, messages);

    let full = '';
    const step = reply.length > 900 ? 5 : 2;
    for (let i = 0; i < reply.length; i += step) {
      if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
      full = reply.slice(0, i + step);
      if (onChunk) onChunk(reply.slice(i, i + step), full);
      await this.sleep(reply.length > 600 ? 8 : 16);
    }
    return reply;
  },

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); },

  demoReply(text, messages) {
    const t = String(text || '').trim();
    const fa = /[\u0600-\u06FF]/.test(t);
    const low = t.toLowerCase();

    if (!t) return fa ? 'چیزی بنویس تا شروع کنیم 😊' : 'Write something and let\'s begin 😊';

    /* — math — */
    const m = t.replace(/[،?=]+$/g, '').replace(/[×x]/gi, '*').replace(/÷/g, '/').replace(/,/g, '');
    if (/^[\d\s+\-*/().^%\d.]+$/.test(m) && /\d/.test(m) && /[+\-*/^%]/.test(m)) {
      try {
        const val = this.calc(m);
        if (val !== null && isFinite(val)) {
          const r = Math.round(val * 1e10) / 1e10;
          const expr = this.prettyNum(m);
          return fa ? `نتیجه این محاسبه:\n\n## ${expr} = ${r} 🧮\n\nچیز دیگه‌ای هم می‌خوای حساب کنم؟`
                    : `Here is the result:\n\n## ${expr} = ${r} 🧮\n\nWant me to calculate anything else?`;
        }
      } catch (e) {}
    }

    /* — greetings — */
    if (/^(سلام|درود|هی|های|هلو|سلم)|^(hi|hey|hello|yo|hola|salut|bonjour|ciao|hii+|helo)\b/i.test(low) && t.length < 25) {
      return fa
        ? 'سلام! 🤖✨ من **Aio** هستم، دستیار هوشمندت.\n\nمی‌تونیم درباره هرچی دوست داری حرف بزنیم — درس، ایده، نوشتن، محاسبه یا فقط گپ. بگو چی به ذهنت می‌رسه!'
        : 'Hello! 🤖✨ I\'m **Aio**, your AI companion.\n\nWe can talk about anything — school, ideas, writing, math or just chat. What\'s on your mind?';
    }

    /* — who are you — */
    if (/(کی هستی|خودتو معرفی|تو چیستی|اسمت چیه|چه کسی|who are you|your name|what are you|introduce yourself)/i.test(low)) {
      return fa
        ? 'من **Aio** هستم — دستیار هوش مصنوعیِ سریع و خوش‌ظاهر! 🚀\n\n- 💬 گفت‌وگو درباره هر موضوعی\n- ✍️ نوشتن و ایده‌پردازی\n- 🧮 محاسبه\n- 🌍 پشتیبانی از خیلی از زبان‌ها\n\nخوشحال می‌شم بیشتر آشنا بشیم — یه سوال ازم بپرس!'
        : 'I\'m **Aio** — your fast, friendly AI companion! 🚀\n\n- 💬 Chat about anything\n- ✍️ Writing & brainstorming\n- 🧮 Calculations\n- 🌍 Many languages\n\nAsk me anything!';
    }

    /* — jokes — */
    if (/(جوک|لطیفه|بخندون|شوخی)|(joke|make me laugh|funny)\b/i.test(low)) {
      const faJokes = [
        'به یارو می‌گن گوشیت چند مگاپیکسل دوربین داره؟ می‌گه ۱۲۸ گیگ! 😂',
        'می‌گن چرا برنامه‌نویس‌ها تاریکی رو دوست دارن؟ چون باگ‌ها رو نمی‌بینن! 🐛😄',
        'یه هوش مصنوعی رفته نانوایی، گفته: یه نون بده. نانوا گفته: سنگک یا بربری؟ گفته: سوال نپرس، تو فقط پردازش کن! 🤖🥖'
      ];
      const enJokes = [
        'Why do programmers love dark mode? Because bugs are attracted to light! 🐛😄',
        'Why did the robot go on vacation? It needed to recharge! 🤖🔋',
        'There are 10 types of people: those who understand binary and those who don\'t. 😏'
      ];
      const arr = fa ? faJokes : enJokes;
      return arr[Math.floor(Math.random() * arr.length)];
    }

    /* — time/date — */
    if (/(ساعت چنده|ساعت چند|تاریخ چنده|امروز چندمه|تاریخ امروز)|(what time|what.s the time|today.s date|what day is it)\b/i.test(low)) {
      const d = new Date();
      const dateStr = d.toLocaleDateString(fa ? 'fa-IR' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const timeStr = d.toLocaleTimeString(fa ? 'fa-IR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
      return fa ? `🕐 الان ساعت **${timeStr}** هست.\n📅 امروز **${dateStr}** است.` : `🕐 It's **${timeStr}**.\n📅 Today is **${dateStr}**.`;
    }

    /* — thanks / bye — */
    if (/(مرسی|ممنون|دستت درد نکنه|لطف کردی)|(thank|thanks|thx|appreciate)\b/i.test(low)) {
      return fa ? 'خواهش می‌کنم! 🌹 همیشه در خدمتم.' : 'You\'re welcome! 🌹 Always here for you.';
    }
    if (/(خداحافظ|بای بای|فعلاً|فعلا|بدرود)|(bye|goodbye|see you|good night)\b/i.test(low)) {
      return fa ? 'خداحافظ! 👋 هر وقت خواستی من همینجاست.' : 'Goodbye! 👋 I\'ll be right here.';
    }

    /* — fallback: helpful, honest, ZERO upsell — */
    const shortTopic = t.length > 60 ? t.slice(0, 60) + '…' : t;
    if (fa) {
      return `سوال خوبی درباره «**${shortTopic}**» پرسیدی! 🤔\n\nالان اتصال مغز اصلی من برقرار نیست و این جواب بهترین چیزیه که همینجا ازش دارم:\n\n- اگه سوال **درسی** بود، اسم درس و مبحث رو هم بگو تا دقیق‌تر راهنمایی‌ات کنم\n- اگه **محاسبه** بود، همون رو بفرست تا حلش کنم 🧮\n- اگه **ایده یا نوشتن** می‌خوای، بگو درباره چی باشه\n\nیه بار دیگه هم امتحان کن — معمولاً دوباره وصل می‌شم! ✨`;
    }
    return `Good question about “**${shortTopic}**”! 🤔\n\nMy main brain isn't reachable right now, so here's what I can still do:\n\n- If it's **school stuff**, tell me the subject and topic for better guidance\n- If it's **math**, just send the expression and I'll solve it 🧮\n- If you need **writing or ideas**, tell me the theme\n\nTry again in a moment — I usually reconnect! ✨`;
  },

  /* ---------- tiny safe calculator (recursive descent) ---------- */
  calc(src) {
    let i = 0;
    const s = String(src).replace(/\s+/g, '');
    const peek = () => s[i];
    const num = () => {
      let j = i;
      while (j < s.length && /[\d.]/.test(s[j])) j++;
      const v = parseFloat(s.slice(i, j));
      i = j;
      return v;
    };
    const primary = () => {
      if (peek() === '(') { i++; const v = expr(); if (peek() === ')') i++; return v; }
      if (peek() === '-') { i++; return -primary(); }
      return num();
    };
    const pow = () => { const b = primary(); if (peek() === '^') { i++; return Math.pow(b, pow()); } return b; };
    const term = () => {
      let v = pow();
      while (peek() === '*' || peek() === '/' || peek() === '%') {
        const op = s[i++]; const r = pow();
        v = op === '*' ? v * r : op === '/' ? v / r : v % r;
      }
      return v;
    };
    function expr() {
      let v = term();
      while (peek() === '+' || peek() === '-') { const op = s[i++]; const r = term(); v = op === '+' ? v + r : v - r; }
      return v;
    }
    const out = expr();
    return (i === s.length && isFinite(out)) ? out : null;
  },

  prettyNum(x) {
    return String(x).replace(/\*/g, '×').replace(/\//g, '÷');
  }
};
