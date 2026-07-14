/* ============================================================
   IBGE 2026 — Painel de Estudos · app.js
   Camada compartilhada: dados locais, sincronização via GitHub
   Gist, chat de dúvidas com IA e overlay dos cursos.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Constantes ---------- */
  const LS_DATA  = "ibge_app_data_v1";
  const LS_TOKEN = "ibge_gh_token";
  const LS_GIST  = "ibge_gist_id";
  const LS_AI    = "ibge_ai_config_v1";
  const GIST_FILE = "ibge-study-data.json";
  const GIST_DESC = "Dados de estudo — IBGE 2026 (Painel de Estudos)";

  const COURSES = {
    pt:  { name: "Língua Portuguesa",        file: "cursos/Curso-Lingua-Portuguesa-IBGE.html",        storageKey: "ibge_curso_pt_v2",  total: 15, q: 15 },
    rlq: { name: "Raciocínio Lógico",        file: "cursos/Curso-Raciocinio-Logico-IBGE.html",        storageKey: "ibge_curso_rlq_v2", total: 10, q: 10 },
    esp: { name: "Conhecimentos Específicos", file: "cursos/Curso-Conhecimentos-Especificos-IBGE.html", storageKey: "ibge_curso_esp_v2", total: 9,  q: 35 }
  };

  const IS_COURSE = typeof window.IBGE_COURSE !== "undefined";
  const COURSE = IS_COURSE ? window.IBGE_COURSE : null;
  const BASE = IS_COURSE ? "../" : "./";

  const SYSTEM_PROMPT = [
    "Você é um professor particular preparando um candidato para o concurso IBGE PSS 02/2026,",
    "cargo Analista Censitário — Webdesign e Produção Gráfica, banca Instituto Avalia.",
    "A prova objetiva (30/08/2026) tem 60 questões: Língua Portuguesa (15), Raciocínio Lógico Quantitativo (10)",
    "e Conhecimentos Específicos de Webdesign e Produção Gráfica (35).",
    "Regras importantes:",
    "1. Responda sempre em português do Brasil, de forma direta e focada em prova.",
    "2. Em Conhecimentos Específicos, o edital cobra Adobe CS6 — NUNCA misture recursos exclusivos do CC. Se um recurso for do CC, avise explicitamente.",
    "3. Use o vocabulário padronizado de banca (boneca, arte-final, retícula, gramatura, fotolito, prova de prelo etc.), mesmo quando houver termo mais moderno.",
    "4. Quando útil, aponte a pegadinha clássica de banca sobre o tema e um macete de memorização.",
    "5. Seja conciso: explique o essencial, dê um exemplo, e pare. O candidato pode pedir aprofundamento."
  ].join(" ");

  /* ============================================================
     1. DADOS LOCAIS (modelo por seções, com timestamp por seção)
     ============================================================ */
  const SECTIONS = ["pt_done", "rlq_done", "esp_done", "notes", "erros", "simulados", "stats"];

  function emptyData() {
    const d = { v: 1, sections: {} };
    SECTIONS.forEach(s => { d.sections[s] = { ts: 0, data: (s === "erros" || s === "simulados") ? [] : {} }; });
    return d;
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(LS_DATA);
      if (!raw) return emptyData();
      const d = JSON.parse(raw);
      if (!d || !d.sections) return emptyData();
      SECTIONS.forEach(s => { if (!d.sections[s]) d.sections[s] = { ts: 0, data: (s === "erros" || s === "simulados") ? [] : {} }; });
      return d;
    } catch (e) { return emptyData(); }
  }

  let DATA = loadData();

  function persistLocal() {
    try { localStorage.setItem(LS_DATA, JSON.stringify(DATA)); } catch (e) {}
  }

  function getSection(name) { return DATA.sections[name].data; }

  function saveSection(name, data) {
    DATA.sections[name] = { ts: Date.now(), data: data };
    persistLocal();
    schedulePush();
    fireEvent("change", { section: name });
  }

  /* Espelha os mapas de conclusão dos cursos (chaves próprias de cada HTML) */
  function importCourseDone(courseId) {
    const c = COURSES[courseId];
    try {
      const done = JSON.parse(localStorage.getItem(c.storageKey) || "{}");
      const current = getSection(courseId + "_done") || {};
      if (JSON.stringify(done) !== JSON.stringify(current)) saveSection(courseId + "_done", done);
    } catch (e) {}
  }

  function exportCourseDone(courseId) {
    const c = COURSES[courseId];
    const done = getSection(courseId + "_done") || {};
    try { localStorage.setItem(c.storageKey, JSON.stringify(done)); } catch (e) {}
  }

  /* ============================================================
     2. SINCRONIZAÇÃO — GitHub Gist secreto
     ============================================================ */
  const Sync = {
    status: "off",           // off | syncing | ok | error
    lastSync: 0,
    message: "",
    get token() { return localStorage.getItem(LS_TOKEN) || ""; },
    set token(t) { t ? localStorage.setItem(LS_TOKEN, t) : localStorage.removeItem(LS_TOKEN); },
    get gistId() { return localStorage.getItem(LS_GIST) || ""; },
    set gistId(id) { id ? localStorage.setItem(LS_GIST, id) : localStorage.removeItem(LS_GIST); }
  };

  function ghHeaders() {
    return {
      "Authorization": "Bearer " + Sync.token,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json"
    };
  }

  function setSyncStatus(status, message) {
    Sync.status = status;
    Sync.message = message || "";
    if (status === "ok") Sync.lastSync = Date.now();
    fireEvent("sync", { status: status, message: Sync.message });
  }

  async function ghFetch(url, opts) {
    const r = await fetch(url, Object.assign({ headers: ghHeaders() }, opts || {}));
    if (r.status === 401 || r.status === 403) throw new Error("Token inválido ou sem permissão de Gist (verifique o escopo \u201cgist\u201d).");
    if (!r.ok) throw new Error("GitHub respondeu " + r.status);
    return r;
  }

  async function findOrCreateGist() {
    if (Sync.gistId) {
      try {
        const r = await ghFetch("https://api.github.com/gists/" + Sync.gistId);
        return await r.json();
      } catch (e) { Sync.gistId = ""; }
    }
    // procura nos gists existentes
    const list = await (await ghFetch("https://api.github.com/gists?per_page=100")).json();
    const found = list.find(g => g.files && g.files[GIST_FILE]);
    if (found) { Sync.gistId = found.id; return await (await ghFetch("https://api.github.com/gists/" + found.id)).json(); }
    // cria
    const created = await (await ghFetch("https://api.github.com/gists", {
      method: "POST",
      body: JSON.stringify({ description: GIST_DESC, public: false, files: { [GIST_FILE]: { content: JSON.stringify(emptyData()) } } })
    })).json();
    Sync.gistId = created.id;
    return created;
  }

  function mergeRemote(remote) {
    let localNewerSomewhere = false;
    let changed = false;
    if (remote && remote.sections) {
      SECTIONS.forEach(s => {
        const loc = DATA.sections[s], rem = remote.sections[s];
        if (!rem) { if (loc.ts > 0) localNewerSomewhere = true; return; }
        if (rem.ts > loc.ts) { DATA.sections[s] = rem; changed = true; }
        else if (loc.ts > rem.ts) { localNewerSomewhere = true; }
      });
    } else {
      localNewerSomewhere = true;
    }
    if (changed) {
      persistLocal();
      Object.keys(COURSES).forEach(exportCourseDone);
      fireEvent("change", { section: "*" });
    }
    return localNewerSomewhere;
  }

  async function pull() {
    if (!Sync.token) return;
    setSyncStatus("syncing");
    try {
      const gist = await findOrCreateGist();
      let file = gist.files[GIST_FILE];
      let content = file.content;
      if (file.truncated) content = await (await fetch(file.raw_url)).text();
      let remote = null;
      try { remote = JSON.parse(content); } catch (e) {}
      const needPush = mergeRemote(remote);
      if (needPush) await pushNow();
      setSyncStatus("ok");
    } catch (e) {
      setSyncStatus("error", e.message || "Falha de rede");
    }
  }

  let pushTimer = null;
  function schedulePush() {
    if (!Sync.token) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushNow, 2500);
  }

  async function pushNow() {
    if (!Sync.token) return;
    clearTimeout(pushTimer); pushTimer = null;
    setSyncStatus("syncing");
    try {
      if (!Sync.gistId) await findOrCreateGist();
      await ghFetch("https://api.github.com/gists/" + Sync.gistId, {
        method: "PATCH",
        body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(DATA) } } }),
        keepalive: true
      });
      setSyncStatus("ok");
    } catch (e) {
      setSyncStatus("error", e.message || "Falha ao enviar");
    }
  }

  async function connectGitHub(token) {
    Sync.token = token.trim();
    Sync.gistId = "";
    await pull();
    if (Sync.status === "error") { Sync.token = ""; throw new Error(Sync.message); }
  }

  function disconnectGitHub() {
    Sync.token = ""; Sync.gistId = "";
    setSyncStatus("off");
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && pushTimer) pushNow();
  });

  /* ============================================================
     3. IA — provedor configurável (Gemini gratuito por padrão,
        ou qualquer API compatível com OpenAI, ex.: Grok/xAI)
     ============================================================ */
  function getAIConfig() {
    try { return JSON.parse(localStorage.getItem(LS_AI) || "null") || { provider: "gemini", geminiKey: "", geminiModel: "gemini-3.1-flash", baseUrl: "https://api.x.ai/v1", apiKey: "", model: "grok-4-1-fast-non-reasoning" }; }
    catch (e) { return { provider: "gemini", geminiKey: "", geminiModel: "gemini-3.1-flash", baseUrl: "https://api.x.ai/v1", apiKey: "", model: "grok-4-1-fast-non-reasoning" }; }
  }
  function setAIConfig(cfg) { localStorage.setItem(LS_AI, JSON.stringify(cfg)); }
  function aiReady() {
    const c = getAIConfig();
    return c.provider === "gemini" ? !!c.geminiKey : !!(c.apiKey && c.baseUrl && c.model);
  }

  /* messages: [{role:'user'|'assistant', content:'...'}] */
  async function aiSend(messages, contextLine) {
    const cfg = getAIConfig();
    const sys = SYSTEM_PROMPT + (contextLine ? ("\nContexto atual do aluno: " + contextLine) : "");
    if (cfg.provider === "gemini") {
      const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(cfg.geminiModel) + ":generateContent";
      const body = {
        systemInstruction: { parts: [{ text: sys }] },
        contents: messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048 }
      };
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.geminiKey }, body: JSON.stringify(body) });
      if (!r.ok) {
        let msg = "Gemini respondeu " + r.status;
        try { const j = await r.json(); if (j.error && j.error.message) msg += " — " + j.error.message; } catch (e) {}
        throw new Error(msg);
      }
      const j = await r.json();
      const cand = j.candidates && j.candidates[0];
      const text = cand && cand.content && cand.content.parts ? cand.content.parts.map(p => p.text || "").join("") : "";
      if (!text) throw new Error("Resposta vazia do modelo (possível bloqueio de conteúdo ou cota).");
      return text;
    } else {
      const url = cfg.baseUrl.replace(/\/+$/, "") + "/chat/completions";
      const body = {
        model: cfg.model,
        messages: [{ role: "system", content: sys }].concat(messages.map(m => ({ role: m.role, content: m.content }))),
        temperature: 0.4
      };
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + cfg.apiKey }, body: JSON.stringify(body) });
      if (!r.ok) {
        let msg = "API respondeu " + r.status;
        try { const j = await r.json(); if (j.error && j.error.message) msg += " — " + j.error.message; } catch (e) {}
        throw new Error(msg);
      }
      const j = await r.json();
      const text = j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : "";
      if (!text) throw new Error("Resposta vazia do modelo.");
      return text;
    }
  }

  /* ============================================================
     4. UTILITÁRIOS
     ============================================================ */
  function fireEvent(kind, detail) {
    window.dispatchEvent(new CustomEvent("ibge-" + kind, { detail: detail || {} }));
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function debounce(fn, ms) { let t; return function () { clearTimeout(t); const a = arguments, s = this; t = setTimeout(() => fn.apply(s, a), ms); }; }
  function fmtDate(ts) {
    const d = new Date(ts);
    return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
  }
  /* Renderização mínima e segura de texto de IA (negrito, código, listas simples) */
  function md(s) {
    let h = esc(s);
    h = h.replace(/```([\s\S]*?)```/g, (m, c) => "<pre>" + c.trim() + "</pre>");
    h = h.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    h = h.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
    h = h.replace(/^[-•] (.*)$/gm, "<div class='ibge-li'>• $1</div>");
    h = h.replace(/^### (.*)$/gm, "<b>$1</b>").replace(/^## (.*)$/gm, "<b>$1</b>");
    h = h.replace(/\n{2,}/g, "<br><br>").replace(/\n/g, "<br>");
    return h;
  }

  /* ============================================================
     5. API PÚBLICA (usada pelo hub)
     ============================================================ */
  window.IBGEApp = {
    COURSES, SECTIONS,
    getSection, saveSection, importCourseDone, exportCourseDone,
    getData: () => DATA,
    replaceData: (d) => { DATA = d; DATA.v = 1; SECTIONS.forEach(s => { if (!DATA.sections[s]) DATA.sections[s] = { ts: Date.now(), data: (s === "erros" || s === "simulados") ? [] : {} }; else DATA.sections[s].ts = Date.now(); }); persistLocal(); Object.keys(COURSES).forEach(exportCourseDone); schedulePush(); fireEvent("change", { section: "*" }); },
    sync: { pull, pushNow, connectGitHub, disconnectGitHub, state: Sync },
    ai: { send: aiSend, getConfig: getAIConfig, setConfig: setAIConfig, ready: aiReady, SYSTEM_PROMPT },
    util: { esc, uid, fmtDate, md, debounce }
  };

  /* Registro do Service Worker (PWA) */
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    window.addEventListener("load", () => { navigator.serviceWorker.register(BASE + "sw.js").catch(() => {}); });
  }

  /* ============================================================
     6. OVERLAY DOS CURSOS (só roda dentro de um curso)
     ============================================================ */
  if (!IS_COURSE) { pull(); return; }

  const courseId = COURSE.id;
  const courseMeta = COURSES[courseId];
  let activeAula = null;   // {id,title}
  let aulaList = [];

  function collectAulas() {
    try { if (typeof AULAS !== "undefined") aulaList = AULAS.map((a, i) => ({ id: a.id, title: "Aula " + String(i + 1).padStart(2, "0") + " · " + a.title })); } catch (e) {}
    if (aulaList.length) activeAula = aulaList[0];
  }

  function trackActiveAula() {
    const onScroll = debounce(() => {
      let best = null, bestTop = -Infinity;
      aulaList.forEach(a => {
        const el = document.getElementById(a.id);
        if (!el) return;
        const top = el.getBoundingClientRect().top;
        if (top <= 140 && top > bestTop) { bestTop = top; best = a; }
      });
      if (!best && aulaList.length) best = aulaList[0];
      if (best && (!activeAula || best.id !== activeAula.id)) {
        activeAula = best;
        const tag = document.getElementById("ibge-fab-aula");
        if (tag) tag.textContent = best.title.split(" · ")[0];
        const sel = document.getElementById("ibge-note-select");
        if (sel && !panelOpen("notes")) sel.value = best.id;
        syncNoteArea();
      }
    }, 150);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---- Hooks nas funções globais do curso ---- */
  function hookCourse() {
    // conclusão de aula → sincroniza
    if (typeof window.markDone === "function") {
      const orig = window.markDone;
      window.markDone = function (cb) { orig(cb); importCourseDone(courseId); };
    }
    // exercícios → estatísticas + oferta de caderno de erros
    if (typeof window.answer === "function") {
      const origA = window.answer;
      window.answer = function (el, qid) {
        const ex = el.closest(".exercise");
        const already = ex && ex.dataset.answered;
        origA(el, qid);
        if (already) return;
        const correct = el.dataset.correct === "true";
        const stats = getSection("stats");
        stats[courseId + ":" + qid] = { ok: correct, when: Date.now() };
        saveSection("stats", stats);
        if (!correct) offerErro(ex, qid);
      };
    }
  }

  function offerErro(ex, qid) {
    const stem = ex && ex.querySelector(".stem") ? ex.querySelector(".stem").textContent.trim() : "";
    const aula = aulaFromQid(qid);
    toast("Errou essa? 📕", "Adicionar ao caderno de erros", () => {
      const erros = getSection("erros");
      erros.unshift({
        id: uid(), disc: courseId,
        topico: aula ? aula.title : courseMeta.name,
        desc: "Exercício: " + stem.slice(0, 220),
        evitar: "", created: Date.now(), rev: { r1: false, r7: false, r16: false }
      });
      saveSection("erros", erros);
      toast("Anotado no caderno de erros ✔");
    });
  }

  function aulaFromQid(qid) {
    const id = qid.replace(/_ex$/, "");
    return aulaList.find(a => a.id === id) || null;
  }

  /* Após o pull remoto, reflete conclusões vindas de outro dispositivo no DOM já renderizado */
  window.addEventListener("ibge-change", (e) => {
    if (e.detail.section !== "*" && e.detail.section !== courseId + "_done") return;
    const map = getSection(courseId + "_done") || {};
    try {
      if (typeof done !== "undefined") { Object.keys(done).forEach(k => delete done[k]); Object.assign(done, map); }
      localStorage.setItem(courseMeta.storageKey, JSON.stringify(map));
      aulaList.forEach(a => {
        const sec = document.getElementById(a.id);
        const cb = document.querySelector('.mark input[data-id="' + a.id + '"]');
        const dot = document.querySelector('[data-dot="' + a.id + '"]');
        const v = !!map[a.id];
        if (sec) sec.classList.toggle("done", v);
        if (cb) cb.checked = v;
        if (dot) dot.innerHTML = v ? '<span class="done-dot">✓</span> ' : "";
      });
      if (typeof window.updateProgress === "function") window.updateProgress();
    } catch (err) {}
    syncNoteArea();
  });

  /* ---- UI: estilos do overlay ---- */
  function injectStyles() {
    const css = `
    .ibge-fab-wrap{position:fixed;right:14px;bottom:14px;z-index:9996;display:flex;flex-direction:column;gap:10px;align-items:flex-end}
    .ibge-fab{display:flex;align-items:center;gap:8px;background:var(--navy,#1f3864);color:#fff;border:none;border-radius:999px;
      padding:11px 16px;font:600 14px/1 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(15,25,60,.28)}
    .ibge-fab:hover{background:var(--blue,#2e75b6)}
    .ibge-fab small{font-weight:500;opacity:.75}
    .ibge-fab:focus-visible{outline:3px solid var(--sky,#5b9bd5);outline-offset:2px}
    body.ibge-panel-open .ibge-fab-wrap{display:none}
    .ibge-panel{position:fixed;top:0;right:0;height:100%;width:min(430px,100%);background:#fff;z-index:9995;box-shadow:-6px 0 24px rgba(15,25,60,.25);
      display:flex;flex-direction:column;transform:translateX(102%);transition:transform .25s ease;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
    .ibge-panel.open{transform:none}
    @media (prefers-reduced-motion:reduce){.ibge-panel{transition:none}}
    .ibge-panel-head{background:var(--navy,#1f3864);color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}
    .ibge-panel-head b{font-size:15px;flex:1}
    .ibge-panel-head button{background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:13px}
    .ibge-panel-body{flex:1;overflow:auto;padding:14px 16px;background:var(--bg,#eef1f8)}
    .ibge-note-select{width:100%;padding:9px 10px;border:1px solid var(--line,#d9e2f3);border-radius:8px;font-size:13px;margin-bottom:10px;background:#fff}
    .ibge-note-area{width:100%;min-height:52vh;resize:vertical;border:1px solid var(--line,#d9e2f3);border-radius:10px;padding:12px;
      font:14px/1.55 system-ui,sans-serif;background:#fffdf2}
    .ibge-note-hint{font-size:12px;color:var(--gray,#5a6172);margin-top:8px}
    .ibge-chat-msgs{display:flex;flex-direction:column;gap:10px}
    .ibge-msg{max-width:92%;padding:10px 13px;border-radius:12px;font-size:14px;line-height:1.55;word-wrap:break-word}
    .ibge-msg.user{align-self:flex-end;background:var(--navy,#1f3864);color:#fff;border-bottom-right-radius:4px}
    .ibge-msg.ai{align-self:flex-start;background:#fff;border:1px solid var(--line,#d9e2f3);border-bottom-left-radius:4px}
    .ibge-msg.ai pre{background:#f2f4fa;padding:8px;border-radius:8px;overflow:auto;font-size:12.5px}
    .ibge-msg.err{align-self:stretch;background:var(--red-bg,#fbeae8);color:var(--red,#b02418);border:1px solid #eecac5;font-size:13px}
    .ibge-msg .ibge-save{margin-top:8px;font-size:12px;background:none;border:1px solid var(--line,#d9e2f3);border-radius:6px;padding:4px 8px;cursor:pointer;color:var(--blue,#2e75b6)}
    .ibge-ctx{font-size:12px;color:var(--gray,#5a6172);background:#fff;border:1px dashed var(--line,#d9e2f3);border-radius:8px;padding:8px 10px;margin-bottom:10px}
    .ibge-chat-form{display:flex;gap:8px;padding:12px 14px;background:#fff;border-top:1px solid var(--line,#d9e2f3)}
    .ibge-chat-form textarea{flex:1;resize:none;border:1px solid var(--line,#d9e2f3);border-radius:10px;padding:10px;font:14px/1.4 system-ui,sans-serif;height:60px}
    .ibge-chat-form button{background:var(--green,#548235);color:#fff;border:none;border-radius:10px;padding:0 18px;font-weight:700;cursor:pointer}
    .ibge-chat-form button:disabled{opacity:.5;cursor:default}
    .ibge-toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#1a2236;color:#fff;padding:11px 16px;border-radius:12px;
      z-index:9999;display:flex;gap:12px;align-items:center;font:14px system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.3);max-width:92vw}
    .ibge-toast button{background:var(--gold,#b8860b);border:none;color:#fff;border-radius:8px;padding:6px 11px;cursor:pointer;font-weight:600;white-space:nowrap}
    .ibge-thinking{font-size:13px;color:var(--gray,#5a6172);font-style:italic}
    `;
    const st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---- UI: botões flutuantes + painéis ---- */
  let chatHistory = [];

  function buildUI() {
    const wrap = document.createElement("div");
    wrap.className = "ibge-fab-wrap";
    wrap.innerHTML =
      '<button class="ibge-fab" id="ibge-fab-chat" title="Tirar dúvida com IA">🤖 Dúvida <small id="ibge-fab-aula"></small></button>' +
      '<button class="ibge-fab" id="ibge-fab-notes" title="Anotações desta disciplina">📝 Notas</button>' +
      '<a class="ibge-fab" id="ibge-fab-home" href="' + BASE + 'index.html" title="Voltar ao painel">🏠 Painel</a>';
    document.body.appendChild(wrap);

    // Painel de notas
    const pn = document.createElement("div");
    pn.className = "ibge-panel"; pn.id = "ibge-panel-notes";
    pn.innerHTML =
      '<div class="ibge-panel-head"><b>📝 Anotações — ' + esc(courseMeta.name) + '</b><button data-switch="chat" title="Ir para as dúvidas">🤖 Dúvidas</button><button data-close>Fechar ✕</button></div>' +
      '<div class="ibge-panel-body">' +
      '<select class="ibge-note-select" id="ibge-note-select" aria-label="Escolher aula"></select>' +
      '<textarea class="ibge-note-area" id="ibge-note-area" placeholder="Escreva suas anotações desta aula…"></textarea>' +
      '<div class="ibge-note-hint">Salva automaticamente e sincroniza com o painel e seus outros dispositivos.</div>' +
      '</div>';
    document.body.appendChild(pn);

    // Painel de chat
    const pc = document.createElement("div");
    pc.className = "ibge-panel"; pc.id = "ibge-panel-chat";
    pc.innerHTML =
      '<div class="ibge-panel-head"><b>🤖 Dúvidas — ' + esc(courseMeta.name) + '</b><button data-switch="notes" title="Ir para as anotações">📝 Notas</button><button data-clear>Limpar</button><button data-close>Fechar ✕</button></div>' +
      '<div class="ibge-panel-body"><div class="ibge-ctx" id="ibge-chat-ctx"></div><div class="ibge-chat-msgs" id="ibge-chat-msgs"></div></div>' +
      '<form class="ibge-chat-form" id="ibge-chat-form">' +
      '<textarea id="ibge-chat-input" placeholder="Pergunte sobre a aula, um exercício ou um trecho selecionado…" aria-label="Sua pergunta"></textarea>' +
      '<button type="submit" id="ibge-chat-send">Enviar</button></form>';
    document.body.appendChild(pc);

    // Preenche o seletor de aulas
    const sel = pn.querySelector("#ibge-note-select");
    aulaList.forEach(a => {
      const o = document.createElement("option");
      o.value = a.id; o.textContent = a.title;
      sel.appendChild(o);
    });
    sel.addEventListener("change", syncNoteArea);

    // Autosave das notas
    const area = pn.querySelector("#ibge-note-area");
    area.addEventListener("input", debounce(() => {
      const key = courseId + ":" + sel.value;
      const notes = getSection("notes");
      const text = area.value;
      if (text.trim() === "" && !notes[key]) return;
      if (text.trim() === "") delete notes[key];
      else notes[key] = { text: text, updated: Date.now() };
      saveSection("notes", notes);
    }, 600));

    // Abertura/fechamento
    document.getElementById("ibge-fab-notes").addEventListener("click", () => togglePanel("notes"));
    document.getElementById("ibge-fab-chat").addEventListener("click", () => togglePanel("chat"));
    document.querySelectorAll(".ibge-panel [data-close]").forEach(b => b.addEventListener("click", () => closePanels()));
    document.querySelectorAll(".ibge-panel [data-switch]").forEach(b => b.addEventListener("click", () => togglePanel(b.dataset.switch)));
    pc.querySelector("[data-clear]").addEventListener("click", () => { chatHistory = []; renderChat(); });

    // Envio do chat
    const form = pc.querySelector("#ibge-chat-form");
    const input = pc.querySelector("#ibge-chat-input");
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      if (!aiReady()) {
        chatHistory.push({ role: "err", content: "A IA ainda não está configurada. Abra o Painel → Configurações, escolha o provedor (Gemini é gratuito) e cole sua chave." });
        renderChat(); return;
      }
      input.value = "";
      chatHistory.push({ role: "user", content: q });
      renderChat(true);
      const btn = pc.querySelector("#ibge-chat-send"); btn.disabled = true;
      try {
        const ctx = buildContext();
        const msgs = chatHistory.filter(m => m.role === "user" || m.role === "assistant").slice(-12);
        const ans = await aiSend(msgs, ctx);
        chatHistory.push({ role: "assistant", content: ans });
      } catch (err) {
        chatHistory.push({ role: "err", content: "Falha ao consultar a IA: " + err.message });
      }
      btn.disabled = false;
      renderChat();
    });
  }

  let selectedText = "";
  document.addEventListener("selectionchange", () => {
    const s = String(window.getSelection() || "").trim();
    if (s.length > 3 && s.length < 1200) selectedText = s;
  });

  function buildContext() {
    let ctx = "Disciplina: " + courseMeta.name + ".";
    if (activeAula) ctx += " " + activeAula.title + ".";
    if (selectedText && panelOpen("chat")) ctx += ' Trecho selecionado pelo aluno: "' + selectedText.slice(0, 900) + '"';
    return ctx;
  }

  function renderChat(thinking) {
    const box = document.getElementById("ibge-chat-msgs");
    const ctxEl = document.getElementById("ibge-chat-ctx");
    if (!box) return;
    ctxEl.innerHTML = "🎯 <b>Contexto enviado:</b> " + esc(activeAula ? activeAula.title : courseMeta.name) +
      (selectedText ? " · trecho selecionado (" + selectedText.length + " caracteres)" : " · selecione um trecho da aula para incluí-lo");
    box.innerHTML = chatHistory.map((m, i) => {
      if (m.role === "user") return '<div class="ibge-msg user">' + esc(m.content) + "</div>";
      if (m.role === "err") return '<div class="ibge-msg err">' + esc(m.content) + "</div>";
      return '<div class="ibge-msg ai">' + md(m.content) + '<br><button class="ibge-save" data-save="' + i + '">💾 Salvar nas anotações da aula</button></div>';
    }).join("") + (thinking ? '<div class="ibge-thinking">professor pensando…</div>' : "");
    box.querySelectorAll("[data-save]").forEach(b => b.addEventListener("click", () => {
      const m = chatHistory[Number(b.dataset.save)];
      const aid = activeAula ? activeAula.id : aulaList[0].id;
      const key = courseId + ":" + aid;
      const notes = getSection("notes");
      const prev = notes[key] ? notes[key].text + "\n\n" : "";
      notes[key] = { text: prev + "🤖 " + m.content, updated: Date.now() };
      saveSection("notes", notes);
      syncNoteArea();
      toast("Resposta salva nas anotações ✔");
    }));
    box.parentElement.scrollTop = box.parentElement.scrollHeight;
  }

  function syncNoteArea() {
    const sel = document.getElementById("ibge-note-select");
    const area = document.getElementById("ibge-note-area");
    if (!sel || !area || document.activeElement === area) return;
    const notes = getSection("notes");
    const n = notes[courseId + ":" + sel.value];
    area.value = n ? n.text : "";
  }

  function panelOpen(which) {
    const p = document.getElementById("ibge-panel-" + which);
    return p && p.classList.contains("open");
  }
  function togglePanel(which) {
    const was = panelOpen(which);
    closePanels();
    if (!was) {
      const p = document.getElementById("ibge-panel-" + which);
      p.classList.add("open");
      if (which === "notes") {
        const sel = document.getElementById("ibge-note-select");
        if (activeAula) sel.value = activeAula.id;
        syncNoteArea();
      }
      if (which === "chat") renderChat();
      document.body.classList.add("ibge-panel-open");
    }
  }
  function closePanels() {
    document.querySelectorAll(".ibge-panel").forEach(p => p.classList.remove("open"));
    document.body.classList.remove("ibge-panel-open");
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanels(); });

  let toastTimer = null;
  function toast(text, btnLabel, onClick) {
    document.querySelectorAll(".ibge-toast").forEach(t => t.remove());
    clearTimeout(toastTimer);
    const t = document.createElement("div");
    t.className = "ibge-toast";
    t.innerHTML = "<span>" + esc(text) + "</span>" + (btnLabel ? "<button>" + esc(btnLabel) + "</button>" : "");
    if (btnLabel) t.querySelector("button").addEventListener("click", () => { t.remove(); onClick && onClick(); });
    document.body.appendChild(t);
    toastTimer = setTimeout(() => t.remove(), btnLabel ? 8000 : 3000);
  }

  /* ---- Inicialização do overlay ---- */
  function initCourse() {
    collectAulas();
    injectStyles();
    buildUI();
    hookCourse();
    trackActiveAula();
    importCourseDone(courseId);   // garante que o estado local atual entra no modelo
    pull();                        // e busca o remoto
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initCourse);
  else initCourse();
})();
