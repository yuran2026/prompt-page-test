// 全域AI提示词工具 - 核心逻辑 v2.0
// 女性粉调文艺风 · H5 MVP版本 · localStorage本地存储
// SENSITIVE_WORDS 由 data/templates.js 定义，此处不重复声明

const APP = {
  // ===== 存储Key常量 =====
  KEYS: {
    USER: 'aiprompt_user',
    COLLECTIONS: 'aiprompt_collections',
    DRAFTS: 'aiprompt_drafts',
    HISTORY: 'aiprompt_history',
    POLISH_USAGE: 'aiprompt_polish_usage',
    USAGE_STATS: 'aiprompt_usage_stats',
    EDITOR_NOTICE_HIDDEN: 'aiprompt_editor_notice_v2',
    MEMBER: 'aiprompt_member',
    FIRST_MONTH_USED: 'aiprompt_first_month_used',
    SEARCH_HISTORY: 'aiprompt_search_history',
    AD_COUNT: 'aiprompt_ad_count',
  },

  // ===== Toast 通知（柔和风格，非红色警告）=====
  toast(msg, duration = 1900, type = 'default') {
    let el = document.getElementById('globalToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'globalToast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = 'toast' + (type === 'success' ? ' toast-success' : '');
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), duration);
  },

  toastSuccess(msg) { this.toast(msg, 1900, 'success'); },

  // ===== 温馨提示弹窗（代替confirm） =====
  confirm(title, text, confirmText = '知道了', cancelText = '取消') {
    return new Promise(resolve => {
      let overlay = document.getElementById('globalConfirm');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'globalConfirm';
        overlay.className = 'modal-center-overlay';
        overlay.innerHTML = `
          <div class="modal-card fade-in">
            <div class="modal-card-title" id="confirmTitle"></div>
            <div class="modal-card-text" id="confirmText"></div>
            <div class="modal-actions">
              <button class="btn btn-outline" id="confirmCancel"></button>
              <button class="btn btn-primary" id="confirmOk"></button>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);
      }
      document.getElementById('confirmTitle').textContent = title;
      document.getElementById('confirmText').textContent = text;
      document.getElementById('confirmOk').textContent = confirmText;
      document.getElementById('confirmCancel').textContent = cancelText;
      overlay.classList.add('show');

      const ok = document.getElementById('confirmOk');
      const cancel = document.getElementById('confirmCancel');
      const cleanup = () => overlay.classList.remove('show');

      const newOk = ok.cloneNode(true);
      const newCancel = cancel.cloneNode(true);
      ok.replaceWith(newOk); cancel.replaceWith(newCancel);

      newOk.onclick = () => { cleanup(); resolve(true); };
      newCancel.onclick = () => { cleanup(); resolve(false); };
      overlay.onclick = e => { if (e.target === overlay) { cleanup(); resolve(false); } };
    });
  },

  // 单按钮提示
  alert(title, text, btnText = '知道了') {
    return new Promise(resolve => {
      let overlay = document.getElementById('globalAlert');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'globalAlert';
        overlay.className = 'modal-center-overlay';
        overlay.innerHTML = `
          <div class="modal-card fade-in">
            <div class="modal-card-title" id="alertTitle"></div>
            <div class="modal-card-text" id="alertText"></div>
            <div style="margin-top:4px">
              <button class="btn btn-primary btn-block" id="alertOk"></button>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);
      }
      document.getElementById('alertTitle').textContent = title;
      document.getElementById('alertText').textContent = text;
      document.getElementById('alertOk').textContent = btnText;
      overlay.classList.add('show');

      const ok = document.getElementById('alertOk');
      const cleanup = () => overlay.classList.remove('show');
      const newOk = ok.cloneNode(true);
      ok.replaceWith(newOk);
      newOk.onclick = () => { cleanup(); resolve(); };
      overlay.onclick = e => { if (e.target === overlay) { cleanup(); resolve(); } };
    });
  },

  // ===== 开发中提示 =====
  comingSoon() {
    this.toast('功能开发中，敬请期待');
  },

  // ===== 本地存储封装 =====
  storage: {
    get(key, defaultVal = null) {
      try {
        const v = localStorage.getItem(key);
        return v !== null ? JSON.parse(v) : defaultVal;
      } catch { return defaultVal; }
    },
    set(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); return true; }
      catch { return false; }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch {}
    }
  },

  // ===== 用户/会员系统 =====
  user: {
    get() {
      return APP.storage.get(APP.KEYS.USER, {
        id: 'guest_' + Date.now(),
        name: '游客用户',
        loginType: 'guest',
        createdAt: Date.now()
      });
    },
    save(info) { APP.storage.set(APP.KEYS.USER, info); },
    isGuest() { return this.get().loginType === 'guest'; },
  },

  member: {
    get() {
      const m = APP.storage.get(APP.KEYS.MEMBER, null);
      if (!m) return { active: false, type: null, expireAt: null };
      if (m.expireAt && Date.now() > m.expireAt) {
        APP.storage.remove(APP.KEYS.MEMBER);
        return { active: false, type: null, expireAt: null };
      }
      return m;
    },
    isActive() { return this.get().active; },
    activate(type, days) {
      const expireAt = Date.now() + days * 86400000;
      APP.storage.set(APP.KEYS.MEMBER, { active: true, type, expireAt, activatedAt: Date.now() });
    },
    getExpireText() {
      const m = this.get();
      if (!m.active) return null;
      const d = Math.ceil((m.expireAt - Date.now()) / 86400000);
      return `${d}天后到期`;
    },
    isFirstMonthUsed() { return APP.storage.get(APP.KEYS.FIRST_MONTH_USED, false); },
    markFirstMonthUsed() { APP.storage.set(APP.KEYS.FIRST_MONTH_USED, true); }
  },

  // ===== 收藏系统 =====
  collections: {
    getAll() { return APP.storage.get(APP.KEYS.COLLECTIONS, []); },
    has(templateId) { return this.getAll().includes(templateId); },
    toggle(templateId) {
      let list = this.getAll();
      if (list.includes(templateId)) {
        list = list.filter(id => id !== templateId);
        APP.storage.set(APP.KEYS.COLLECTIONS, list);
        return false;
      } else {
        list.unshift(templateId);
        APP.storage.set(APP.KEYS.COLLECTIONS, list);
        return true;
      }
    },
    count() { return this.getAll().length; }
  },

  // ===== 草稿箱 (上限10个) =====
  drafts: {
    getAll() { return APP.storage.get(APP.KEYS.DRAFTS, []); },
    save(draft) {
      let list = this.getAll();
      const existing = list.findIndex(d => d.id === draft.id);
      if (existing >= 0) {
        list[existing] = { ...list[existing], ...draft, updatedAt: Date.now() };
      } else {
        if (list.length >= 10) {
          APP.toast('草稿已满（上限10个），请先删除部分草稿');
          return false;
        }
        list.unshift({ ...draft, id: 'draft_' + Date.now(), createdAt: Date.now(), updatedAt: Date.now() });
      }
      APP.storage.set(APP.KEYS.DRAFTS, list);
      return true;
    },
    delete(draftId) {
      const list = this.getAll().filter(d => d.id !== draftId);
      APP.storage.set(APP.KEYS.DRAFTS, list);
    },
    count() { return this.getAll().length; }
  },

  // ===== 历史记录 =====
  history: {
    getAll() {
      const cutoff = Date.now() - 30 * 86400000;
      return (APP.storage.get(APP.KEYS.HISTORY, [])).filter(h => h.timestamp > cutoff);
    },
    add(templateId, templateTitle) {
      let list = this.getAll();
      list = list.filter(h => h.templateId !== templateId);
      list.unshift({ templateId, templateTitle, timestamp: Date.now() });
      APP.storage.set(APP.KEYS.HISTORY, list.slice(0, 200));
    },
    count() { return this.getAll().length; }
  },

  // ===== 润色次数管理（每日0点重置）=====
  polishUsage: {
    _getTodayKey() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    },
    get() {
      const data = APP.storage.get(APP.KEYS.POLISH_USAGE, {});
      const key = this._getTodayKey();
      if (!data[key]) return { base: 3, adBonus: 0, used: 0 };
      return data[key];
    },
    getRemaining() {
      if (APP.member.isActive()) return Infinity;
      const u = this.get();
      return Math.max(0, u.base + u.adBonus - (u.used || 0));
    },
    use() {
      if (APP.member.isActive()) return true;
      const key = this._getTodayKey();
      const data = APP.storage.get(APP.KEYS.POLISH_USAGE, {});
      if (!data[key]) data[key] = { base: 3, adBonus: 0, used: 0 };
      const remaining = data[key].base + data[key].adBonus - data[key].used;
      if (remaining <= 0) return false;
      data[key].used++;
      APP.storage.set(APP.KEYS.POLISH_USAGE, data);
      return true;
    },
    addAdBonus() {
      // 广告解锁：单次+1，但当日总上限不叠加（每日最多5次额外）
      const key = this._getTodayKey();
      const data = APP.storage.get(APP.KEYS.POLISH_USAGE, {});
      if (!data[key]) data[key] = { base: 3, adBonus: 0, used: 0 };
      if (data[key].adBonus >= 5) {
        APP.toast('今日广告加成已满，明日再试吧');
        return false;
      }
      data[key].adBonus++;
      APP.storage.set(APP.KEYS.POLISH_USAGE, data);
      return true;
    }
  },

  // ===== 广告次数管理（插屏每日最多5次）=====
  adCount: {
    _getTodayKey() {
      const d = new Date();
      return `ad_${d.getFullYear()}_${d.getMonth()}_${d.getDate()}`;
    },
    getToday() { return APP.storage.get(APP.KEYS.AD_COUNT + this._getTodayKey(), 0); },
    canShow() { return this.getToday() < 5; },
    record() {
      const key = APP.KEYS.AD_COUNT + this._getTodayKey();
      APP.storage.set(key, this.getToday() + 1);
    }
  },

  // ===== 使用统计 =====
  stats: {
    get() {
      return APP.storage.get(APP.KEYS.USAGE_STATS, { totalCopies: 0, polishCount: 0 });
    },
    recordCopy() {
      const s = this.get();
      s.totalCopies = (s.totalCopies || 0) + 1;
      APP.storage.set(APP.KEYS.USAGE_STATS, s);
    },
    recordPolish() {
      const s = this.get();
      s.polishCount = (s.polishCount || 0) + 1;
      APP.storage.set(APP.KEYS.USAGE_STATS, s);
    }
  },

  // ===== 搜索历史 =====
  searchHistory: {
    getAll() { return APP.storage.get(APP.KEYS.SEARCH_HISTORY, []); },
    add(keyword) {
      if (!keyword.trim()) return;
      // 敏感词检测
      if (APP.checkSensitive(keyword)) return;
      let list = this.getAll().filter(k => k !== keyword);
      list.unshift(keyword);
      APP.storage.set(APP.KEYS.SEARCH_HISTORY, list.slice(0, 10));
    },
    clear() { APP.storage.set(APP.KEYS.SEARCH_HISTORY, []); }
  },

  // ===== 敏感词检测（前端拦截）=====
  checkSensitive(text) {
    if (!text) return null;
    const t = text.toLowerCase();
    return SENSITIVE_WORDS.find(w => t.includes(w)) || null;
  },

  // ===== 复制到剪贴板 =====
  async copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      return true;
    } catch { return false; }
  },

  // ===== 导出TXT（仅支持.txt格式）=====
  exportTxt(content, filename = '提示词') {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${formatDate()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // ===== 跳转页面 =====
  navigate(page, params = {}) {
    // 支持page本身已含有query string的情况
    const [basePage, existingQuery] = page.split('?');
    const existingParams = existingQuery ? Object.fromEntries(new URLSearchParams(existingQuery)) : {};
    const allParams = { ...existingParams, ...params };
    const paramStr = Object.keys(allParams).length
      ? '?' + Object.entries(allParams).map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
      : '';
    window.location.href = basePage + paramStr;
  },

  getParam(key) {
    return new URLSearchParams(window.location.search).get(key);
  },

  formatTime(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    const d = new Date(ts);
    return `${d.getMonth()+1}月${d.getDate()}日`;
  },

  // ===== AI润色逻辑（本地规则处理，不调用API）=====
  polishText(text, style) {
    const labels = { simple: '简洁版', detailed: '详细版', professional: '专业版', colloquial: '口语版' };
    return `【${labels[style] || '润色'}结果】\n\n` + optimizeText(text, style);
  }
};

// ===== 本地文本优化引擎 =====
function optimizeText(text, style) {
  let result = text.trim().replace(/\s+/g, ' ').replace(/，，+/g, '，').replace(/。。+/g, '。');
  const roleMatch = result.match(/(?:你是|作为|扮演|假设你是)[一个位]?([^，。\n,]{2,10})/);
  const role = roleMatch ? roleMatch[1] : null;

  switch (style) {
    case 'simple':
      result = result.replace(/请你|请您|麻烦你|帮我|帮忙/g, '请')
                     .replace(/非常|十分|极其|特别|相当/g, '很')
                     .replace(/就是说|也就是|换言之/g, '即');
      return `你是一位${role || '专业助手'}。\n\n${result}\n\n要求：语言简洁，直达核心。`;
    case 'detailed':
      return `你是一位经验丰富的${role || '专业顾问'}。\n\n任务背景：${result}\n\n请按以下结构详细回答：\n1. 核心要点分析\n2. 具体步骤（分条列明）\n3. 注意事项\n4. 总结与建议`;
    case 'professional':
      return `你是一位具备顶级专业背景的${role || '领域专家'}，熟悉行业最佳实践。\n\n需求说明：${result}\n\n请以专业标准输出，使用准确术语，结论明确可验证。\n输出格式：含摘要、正文、结论三部分。`;
    case 'colloquial':
      result = result.replace(/请/g, '帮我').replace(/分析|阐述|论述/g, '说说').replace(/输出|生成|产出/g, '写出');
      return `假设你是我身边最靠谱的${role || '朋友'}。\n\n我想让你帮我：${result}\n\n用轻松的方式跟我说，不用太正式，有什么建议直接讲。`;
    default:
      return result;
  }
}

// ===== 工具函数 =====
function formatDate() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

function formatNum(n) {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n;
}

function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== 模板过滤与排序 =====
function filterTemplates(templates, { categoryId, keyword, sortMode } = {}) {
  let result = [...templates];

  if (categoryId && categoryId !== 'all') {
    result = result.filter(t => t.categoryId === categoryId);
  }

  if (keyword && keyword.trim()) {
    const kw = keyword.trim().toLowerCase();
    if (APP.checkSensitive(kw)) return []; // 敏感词拦截返回空
    result = result.filter(t =>
      (t.title || '').toLowerCase().includes(kw) ||
      (t.scene || '').toLowerCase().includes(kw) ||
      (t.tags || []).some(tag => tag.toLowerCase().includes(kw))
    );
  }

  if (sortMode === 'hot') {
    result.sort((a, b) => (b.useCount + b.likes * 2) - (a.useCount + a.likes * 2));
  } else {
    result.sort((a, b) => b.id - a.id);
  }

  return result;
}

// ===== 渲染模板卡片（小红书单列流风格）=====
function renderTemplateCard(template) {
  const isMember = APP.member.isActive();
  const isCollected = APP.collections.has(template.id);
  const canView = template.isFree || isMember;

  const badgeHtml = template.isPremium
    ? '<span class="badge badge-premium">会员专享</span>'
    : '<span class="badge badge-free">免费</span>';

  const previewText = canView
    ? escHtml(template.content.substring(0, 120)) + (template.content.length > 120 ? '…' : '')
    : escHtml(template.content.substring(0, 40)) + '…';

  const lockHtml = !canView ? `
    <div class="card-preview-lock tap-feedback" onclick="showMemberModal(${template.id},event)">
      <svg class="lock-icon-svg" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      会员专享 · 开通后查看完整提示词
    </div>
  ` : '';

  const copyBtnHtml = canView
    ? `<button class="copy-btn tap-feedback" onclick="handleCopy(${template.id},event)">
        <svg style="width:13px;height:13px;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        一键复制
      </button>`
    : `<button class="copy-btn tap-feedback" style="background:var(--bg-rose);color:var(--primary-dark);border:1.5px solid var(--border-pink)" onclick="showMemberModal(${template.id},event)">
        <svg style="width:13px;height:13px;stroke:var(--primary-dark);fill:none;stroke-width:2;stroke-linecap:round" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        解锁复制
      </button>`;

  return `
    <div class="template-card ${template.isPremium ? 'premium' : ''} fade-in" data-id="${template.id}" onclick="openTemplateDetail(${template.id})">
      <div class="card-header">
        <div class="card-title">${escHtml(template.title)}</div>
        <div class="card-badges">${badgeHtml}</div>
      </div>
      <div class="card-scene">${escHtml(template.scene)}</div>
      <div class="card-preview ${!canView ? 'blurred' : ''}">${previewText}</div>
      ${lockHtml}
      <div class="tag-list">
        ${(template.tags || []).map(t => `<span class="tag">#${escHtml(t)}</span>`).join('')}
      </div>
      <div class="card-footer" onclick="event.stopPropagation()">
        <div class="card-meta">
          <span class="meta-item">
            <svg class="meta-icon-svg" viewBox="0 0 24 24"><path d="M9 9a3 3 0 1 1 6 0 3 3 0 0 1-6 0M17.5 21c-.56-3.1-2.97-5-5.5-5s-4.94 1.9-5.5 5"/></svg>
            ${formatNum(template.useCount)}
          </span>
          <span class="meta-item">
            <svg class="meta-icon-svg" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            ${formatNum(template.likes)}
          </span>
        </div>
        <div class="card-actions">
          <button class="action-btn ${isCollected ? 'collected' : ''}"
            onclick="handleCollect(${template.id},this,event)">
            <svg class="action-btn-svg" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
          ${copyBtnHtml}
        </div>
      </div>
    </div>
  `;
}

// ===== 全局操作函数 =====
async function handleCopy(templateId, event) {
  if (event) event.stopPropagation();
  const template = TEMPLATE_DB.templates.find(t => t.id === templateId);
  if (!template) return;

  const isMember = APP.member.isActive();
  if (!template.isFree && !isMember) {
    showMemberModal(templateId);
    return;
  }

  // 敏感词检测
  const sensitive = APP.checkSensitive(template.content);
  if (sensitive) {
    APP.toast('该内容含不当词汇，无法复制');
    return;
  }

  const success = await APP.copyText(template.content);
  if (success) {
    APP.toastSuccess('已复制到剪贴板');
    APP.history.add(template.id, template.title);
    APP.stats.recordCopy();
    template.useCount++;
  } else {
    APP.toast('复制失败，请长按文字手动复制');
  }
}

function handleCollect(templateId, btn, event) {
  if (event) event.stopPropagation();
  const isNow = APP.collections.toggle(templateId);
  btn.classList.toggle('collected', isNow);
  APP.toast(isNow ? '已加入收藏' : '已取消收藏');
}

function openTemplateDetail(templateId) {
  // 智能路径：根据当前页面深度自动调整
  const pathname = window.location.pathname;
  const isInPages = pathname.includes('/pages/') || pathname.includes('\\pages\\');
  const base = isInPages ? '' : 'pages/';
  APP.navigate(base + 'template-detail.html', { id: templateId });
}

function showMemberModal(templateId, event) {
  if (event) event.stopPropagation();
  // 弹出会员弹窗（底部sheet样式）
  let overlay = document.getElementById('memberModal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'memberModal';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-sheet fade-in">
        <div class="modal-handle"></div>
        <div style="text-align:center;margin-bottom:18px">
          <div style="width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#FFD700,#FFA500);display:flex;align-items:center;justify-content:center;margin:0 auto 12px">
            <svg style="width:28px;height:28px;fill:#fff" viewBox="0 0 24 24"><path d="M2 20l3-10 4 5 3-8 3 8 4-5 3 10H2z"/></svg>
          </div>
          <div style="font-size:18px;font-weight:800;color:var(--text-main);margin-bottom:6px">开通会员·解锁全部内容</div>
          <div style="font-size:13px;color:var(--text-hint)">海量高阶模板 · 无限AI润色 · 首月仅¥3.9</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px">
          ${['全部高阶模板','无限AI润色','无广告干扰','优先更新'].map(p=>`
            <div style="background:var(--bg-rose);border-radius:12px;padding:10px;font-size:13px;display:flex;align-items:center;gap:6px">
              <svg style="width:16px;height:16px;stroke:var(--primary);fill:none;stroke-width:2;flex-shrink:0" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              ${p}
            </div>
          `).join('')}
        </div>
        <div style="font-size:11px;color:var(--text-hint);text-align:center;margin-bottom:12px;background:var(--bg-global);border-radius:10px;padding:7px 10px">
          本为虚拟服务，非功能故障不予退款，购买前请知悉
        </div>
        <button class="btn btn-primary btn-block btn-lg" onclick="navigateToVip()">
          立即开通  首月仅¥3.9
        </button>
        <button class="btn btn-outline btn-block" style="margin-top:10px" onclick="document.getElementById('memberModal').classList.remove('show')">
          暂时不了
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('show');
    });
  }
  overlay.classList.add('show');
}

// ===== 底部TabBar初始化 =====
function initTabBar(activePage) {
  document.querySelectorAll('.tab-item').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.page === activePage);
    tab.addEventListener('click', () => {
      const page = tab.dataset.page;
      // 判断当前路径深度（兼容file://、http://、Windows路径等）
      const pathname = window.location.pathname;
      const isInPages = pathname.includes('/pages/') || pathname.includes('\\pages\\');
      const base = isInPages ? '../' : '';
      const routes = {
        home:    base + 'index.html',
        search:  base + 'pages/search.html',
        editor:  base + 'pages/editor.html',
        polish:  base + 'pages/polish.html',
        profile: base + 'pages/profile.html'
      };
      if (routes[page] && page !== activePage) {
        window.location.href = routes[page];
      }
    });
  });
}

// ===== 返回按钮 =====
function initBackBtn() {
  const back = document.querySelector('.navbar-back');
  if (back) {
    back.addEventListener('click', () => {
      if (history.length > 1) {
        history.back();
      } else {
        const pathname = window.location.pathname;
        const isInPages = pathname.includes('/pages/') || pathname.includes('\\pages\\');
        window.location.href = isInPages ? '../index.html' : 'index.html';
      }
    });
  }
}

// 导出到全局
window.APP = APP;
window.SENSITIVE_WORDS = SENSITIVE_WORDS;
window.filterTemplates = filterTemplates;
window.renderTemplateCard = renderTemplateCard;
window.handleCopy = handleCopy;
window.handleCollect = handleCollect;
window.openTemplateDetail = openTemplateDetail;
window.showMemberModal = showMemberModal;
window.initTabBar = initTabBar;
window.initBackBtn = initBackBtn;
window.formatNum = formatNum;
window.escHtml = escHtml;

// ===== 智能路径辅助函数 =====
// 根据当前页面深度，自动计算正确的相对路径
function getSmartPath(pageInPages) {
  const pathname = window.location.pathname;
  const isInPages = pathname.includes('/pages/') || pathname.includes('\\pages\\');
  if (isInPages) {
    // 当前在pages/目录，直接用文件名
    return pageInPages.replace('pages/', '');
  } else {
    // 当前在根目录
    return pageInPages;
  }
}

// 导航到会员页
function navigateToVip() {
  APP.navigate(getSmartPath('pages/vip.html'));
}

window.getSmartPath = getSmartPath;
window.navigateToVip = navigateToVip;
