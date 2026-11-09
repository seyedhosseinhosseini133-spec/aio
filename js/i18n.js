/* ============ Aio — i18n core (50 languages) ============ */
'use strict';

const I18N = {
  /* Registered by i18n-data-*.js */
  REG: (window.I18N_REG = window.I18N_REG || {}),

  LANGS: {
    'fa':   { native: 'فارسی', rtl: true },
    'en':   { native: 'English' },
    'ar':   { native: 'العربية', rtl: true },
    'es':   { native: 'Español' },
    'fr':   { native: 'Français' },
    'de':   { native: 'Deutsch' },
    'it':   { native: 'Italiano' },
    'pt':   { native: 'Português' },
    'nl':   { native: 'Nederlands' },
    'ru':   { native: 'Русский' },
    'tr':   { native: 'Türkçe' },
    'zh':   { native: '中文（简体）' },
    'zh-TW':{ native: '中文（繁體）' },
    'ja':   { native: '日本語' },
    'ko':   { native: '한국어' },
    'hi':   { native: 'हिन्दी' },
    'bn':   { native: 'বাংলা' },
    'ur':   { native: 'اردو', rtl: true },
    'id':   { native: 'Bahasa Indonesia' },
    'ms':   { native: 'Bahasa Melayu' },
    'th':   { native: 'ไทย' },
    'vi':   { native: 'Tiếng Việt' },
    'fil':  { native: 'Filipino' },
    'sv':   { native: 'Svenska' },
    'no':   { native: 'Norsk' },
    'da':   { native: 'Dansk' },
    'fi':   { native: 'Suomi' },
    'pl':   { native: 'Polski' },
    'cs':   { native: 'Čeština' },
    'sk':   { native: 'Slovenčina' },
    'hu':   { native: 'Magyar' },
    'ro':   { native: 'Română' },
    'bg':   { native: 'Български' },
    'el':   { native: 'Ελληνικά' },
    'uk':   { native: 'Українська' },
    'he':   { native: 'עברית', rtl: true },
    'kk':   { native: 'Қазақша' },
    'az':   { native: 'Azərbaycanca' },
    'ka':   { native: 'ქართული' },
    'hy':   { native: 'Հայերեն' },
    'sr':   { native: 'Српски' },
    'hr':   { native: 'Hrvatski' },
    'sl':   { native: 'Slovenščina' },
    'lt':   { native: 'Lietuvių' },
    'lv':   { native: 'Latviešu' },
    'et':   { native: 'Eesti' },
    'mk':   { native: 'Македонски' },
    'sw':   { native: 'Kiswahili' },
    'ps':   { native: 'پښتو', rtl: true },
    'ku':   { native: 'کوردی', rtl: true },
    'ne':   { native: 'नेपाली' }
  },

  EN: {
    newChat: 'New chat', searchChats: 'Search chats…', noChats: 'No chats yet',
    settings: 'Settings', profile: 'Profile', appearance: 'Appearance', aiSettings: 'AI', about: 'About',
    name: 'Name', namePlaceholder: 'Enter your name…', changePhoto: 'Change photo', language: 'Language',
    theme: 'Theme', dark: 'Dark', light: 'Light', accentColor: 'Accent color',
    provider: 'Provider', providerDemo: 'Demo mode (no key needed)', providerCustom: 'Custom',
    apiKey: 'API Key', apiKeyHint: 'Your key is stored only on this device. Get a free key from Google AI Studio (Gemini) or OpenRouter.',
    model: 'Model', baseUrl: 'Base URL',
    save: 'Save', cancel: 'Cancel', delete: 'Delete', rename: 'Rename',
    renamePrompt: 'New name for this chat:', deleteConfirm: 'Delete this chat permanently?',
    clearData: 'Delete all chats', clearDataConfirm: 'Delete ALL chats permanently?',
    welcomeTitle: 'Hi{name}! I am Aio 👋', welcomeSub: 'How can I help you today?',
    chip1: 'Give me a creative idea ✨', chip2: 'Write me a short story 📖',
    chip3: 'Explain something to me 🧠', chip4: 'Help me write code 💻',
    inputPlaceholder: 'Type your message…', thinking: 'Thinking', stop: 'Stop',
    copy: 'Copy', copied: 'Copied!', regenerate: 'Regenerate', listen: 'Listen', stopAudio: 'Stop audio',
    micNoSupport: 'Voice input is not supported in this browser',
    demoBadge: 'DEMO', installApp: 'Install app',
    installGuideTitle: 'Install Aio on your device',
    installAndroid: 'Menu ⋮ → “Install app”',
    installIos: 'Share button ↓ → “Add to Home Screen”',
    installDesktop: 'Click the install icon in the browser address bar',
    you: 'You', errorMessage: 'Something went wrong. Please try again.',
    disclaimer: 'Aio can make mistakes. Check important info.',
    savedToast: 'Saved ✓', clearDone: 'All chats deleted',
    voiceHint: 'Speak now…', removePhoto: 'Remove photo',
    providerFree: 'Aio Smart — free, no key needed',
    voiceLang: 'Voice-to-text language',
    autoVoice: 'Auto (match app language)',
    searchFail: 'Web search unavailable right now — answering from my own knowledge',
    webSearchBadge: 'Web search',
    webSources: 'Web sources',
    homePlaceholder: 'Search the web or ask the AI…'
  },

  lang: 'en',

  /* small per-language patches for keys added after the main data files */
  PATCH: {
    fa: {
      voiceHint: 'حالا صحبت کن…',
      removePhoto: 'حذف عکس',
      providerFree: 'Aio هوشمند (رایگان — بدون کلید)',
      voiceLang: 'زبان صوت به متن',
      autoVoice: 'خودکار (هماهنگ با زبان اپ)',
      searchFail: 'جست‌وجوی وب الان در دسترس نیست — از دانش خودم جواب می‌دم',
      webSearchBadge: 'جست‌وجوی وب',
      webSources: 'منابع وب',
      homePlaceholder: 'جست‌وجو در وب یا پرسیدن از هوش…'
    },
    ar: {
      voiceHint: 'تحدّث الآن…',
      removePhoto: 'إزالة الصورة',
      providerFree: 'Aio الذكي (مجاني — بدون مفتاح)',
      voiceLang: 'لغة تحويل الصوت لنص',
      autoVoice: 'تلقائي (مطابقة لغة التطبيق)'
    }
  },

  detect() {
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    const base = nav.toLowerCase().split('-')[0];
    if (this.LANGS[nav]) return nav;
    // zh-TW special case
    if (/^zh[-_]?(tw|hk|hant)/i.test(nav)) return 'zh-TW';
    const byBase = Object.keys(this.LANGS).find(k => k.toLowerCase().split('-')[0] === base);
    return byBase || 'en';
  },

  init(saved) {
    this.lang = (saved && saved !== 'auto' && this.LANGS[saved]) ? saved : this.detect();
  },

  t(key, vars) {
    const table = this.REG[this.lang] || {};
    const patch = this.PATCH[this.lang] || {};
    let s = table[key] !== undefined ? table[key]
      : patch[key] !== undefined ? patch[key]
      : this.EN[key] || key;
    if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
    return s;
  },

  isRTL() { return !!(this.LANGS[this.lang] && this.LANGS[this.lang].rtl); },

  apply() {
    document.documentElement.lang = this.lang === 'zh-TW' ? 'zh-TW' : this.lang;
    document.documentElement.dir = this.isRTL() ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = this.t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      el.placeholder = this.t(el.getAttribute('data-i18n-ph'));
    });
  }
};
