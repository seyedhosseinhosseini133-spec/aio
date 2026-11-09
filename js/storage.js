/* ============ Aio — Storage (localStorage) ============ */
'use strict';

const Store = {
  PREFIX: 'aio_',

  get(key, def) {
    try {
      const v = localStorage.getItem(this.PREFIX + key);
      return v === null ? def : JSON.parse(v);
    } catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem(this.PREFIX + key, JSON.stringify(val)); } catch {}
  },
  remove(key) {
    try { localStorage.removeItem(this.PREFIX + key); } catch {}
  },

  /* ---------- Settings ---------- */
  DEFAULT_SETTINGS: {
    lang: 'auto',
    theme: 'dark',
    accent: 'violet',
    provider: 'aio-free',
    apiKey: '',
    model: '',
    baseUrl: '',
    userName: '',
    userPhoto: '',
    tts: false,
    voiceLang: 'auto'
  },

  settings() {
    return Object.assign({}, this.DEFAULT_SETTINGS, this.get('settings', {}));
  },
  saveSettings(patch) {
    const s = Object.assign(this.settings(), patch);
    this.set('settings', s);
    return s;
  },

  /* ---------- Chats ---------- */
  chats() {
    const list = this.get('chats', []);
    return Array.isArray(list) ? list : [];
  },
  saveChats(list) {
    // keep only last 100 chats to protect quota
    this.set('chats', list.slice(0, 100));
  },
  createChat(title) {
    const chat = {
      id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      title: title || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };
    const list = this.chats();
    list.unshift(chat);
    this.saveChats(list);
    return chat;
  },
  getChat(id) {
    return this.chats().find(c => c.id === id) || null;
  },
  updateChat(id, patch) {
    const list = this.chats();
    const i = list.findIndex(c => c.id === id);
    if (i === -1) return null;
    list[i] = Object.assign({}, list[i], patch, { updatedAt: Date.now() });
    this.saveChats(list);
    return list[i];
  },
  deleteChat(id) {
    this.saveChats(this.chats().filter(c => c.id !== id));
  },
  renameChat(id, title) {
    return this.updateChat(id, { title: title.trim() || 'Untitled' });
  },
  addMessage(id, msg) {
    const chat = this.getChat(id);
    if (!chat) return null;
    chat.messages.push(Object.assign({ ts: Date.now() }, msg));
    return this.updateChat(id, { messages: chat.messages });
  },
  clearAllChats() {
    this.remove('chats');
  }
};
