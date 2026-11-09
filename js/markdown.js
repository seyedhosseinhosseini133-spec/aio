/* ============ Aio — Minimal safe Markdown renderer ============ */
'use strict';

const MD = {
  esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  render(text) {
    if (!text) return '';
    const blocks = [];
    let src = String(text).replace(/\r\n?/g, '\n');

    // extract fenced code blocks first
    src = src.replace(/```(\w*)\n?([\s\S]*?)(?:```|$)/g, (m, lang, code) => {
      const raw = code.replace(/\n$/, '');
      if (window.__codeRegistry.length > 300) window.__codeRegistry.length = 0;
      const i = window.__codeRegistry.push(raw) - 1;
      const isHtml = /^(html|markup|svg|xml)$/i.test(lang || '');
      const runBtn = isHtml && raw.length > 60
        ? '<button class="cb-run" data-code="' + i + '"><svg viewBox="0 0 24 24"><use href="#i-zap"/></svg>Run</button>' : '';
      const b = '<div class="codeblock"><div class="cb-head">' +
        '<span class="cb-dots"><i></i><i></i><i></i></span>' +
        '<span class="cb-meta"><span class="cb-lang">' + this.esc(lang || 'code') + '</span>' +
        runBtn +
        '<button class="cb-copy" data-code="' + i + '"><svg viewBox="0 0 24 24"><use href="#i-copy"/></svg>Copy</button></span>' +
        '</div><pre><code>' + this.esc(raw) + '</code></pre></div>';
      blocks.push({ html: b, raw });
      return '\u0000CODE' + i + '\u0000';
    });

    let html = this.esc(src);

    // inline code
    html = html.replace(/`([^`\n]+)`/g, '<code class="inline">$1</code>');

    // bold / italic
    html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

    // headings
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // images ![alt](url)
    html = html.replace(/!\[([^\]\n]*)\]\((https?:\/\/[^\s)]+)\)/g,
      '<img class="msg-img" src="$2" alt="$1" loading="lazy">');

    // links [text](url)
    html = html.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // blockquote
    html = html.replace(/^&gt;\s?(.+)$/gm, '<blockquote>$1</blockquote>');

    // hr
    html = html.replace(/^(?:---|\*\*\*)\s*$/gm, '<hr>');

    // lists (process line groups)
    html = html.replace(/(?:^[-•]\s+.+(?:\n|$))+/gm, m => {
      const items = m.trim().split('\n').map(l => '<li>' + l.replace(/^[-•]\s+/, '') + '</li>').join('');
      return '<ul>' + items + '</ul>';
    });
    html = html.replace(/(?:^\d+[.)]\s+.+(?:\n|$))+/gm, m => {
      const items = m.trim().split('\n').map(l => '<li>' + l.replace(/^\d+[.)]\s+/, '') + '</li>').join('');
      return '<ol>' + items + '</ol>';
    });

    // paragraphs & line breaks
    const parts = html.split(/\n{2,}/).map(par => {
      const t = par.trim();
      if (!t) return '';
      if (/^<(h1|h2|h3|ul|ol|pre|blockquote|hr|div)/.test(t) || /^\u0000CODE\d+\u0000$/.test(t)) return t;
      return '<p>' + t.replace(/\n/g, '<br>') + '</p>';
    }).join('\n');
    html = parts;

    // restore code blocks
    html = html.replace(/\u0000CODE(\d+)\u0000/g, (m, i) => blocks[+i] ? blocks[+i].html : '');

    return html;
  },

  codeRaw(blocks) { return blocks; }
};

// expose raw code for copy buttons via a global registry
window.__codeRegistry = [];
