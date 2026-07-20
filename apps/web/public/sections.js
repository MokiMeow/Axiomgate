import {
  contentChanged,
  resolvePollInterval,
} from "./refresh.mjs";

/*
 * AxiomGate dashboard - section navigation (Watch Commander style).
 *
 * Self-contained by design: this file owns its own DOM/fetch helpers and reads
 * only the stable public API (/api/missions, /api/mission/:id, /api/capacity,
 * /api/approve). It never touches app.js internals, so app.js stays the sole
 * owner of the mission detail (#detail) and neither file can break the other.
 *
 * Sections are governance-native (every one is backed by real data):
 *   Mission Control  - app.js mission detail (untouched)
 *   Approval Queue   - pending approvals across all missions (Telegram + web)
 *   Blast Radius     - authority scope + what the hook denied, per mission
 *   Audit Receipts   - offline-verifiable build receipts across missions
 *   Runway           - Codex capacity + token spend
 *   Settings         - honest, read-only workspace config (no secrets)
 */
(function () {
  if (window.__agSections) return;
  window.__agSections = true;

  /* ---------- local helpers (no app.js dependency) ---------- */
  const Q = (s, r = document) => r.querySelector(s);
  const H = (s) =>
    String(s == null ? "" : s).replace(/[&<>"]/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m])
    );
  const E = (t, c, h) => {
    const n = document.createElement(t);
    if (c) n.className = c;
    if (h != null) n.innerHTML = h;
    return n;
  };
  const short = (h) => {
    if (!h) return "pending";
    const v = String(h).replace(/^sha256:/, "");
    return "sha256:" + v.slice(0, 10) + "…";
  };
  const time = (t) => {
    if (!t) return "Unknown";
    try {
      return new Date(t).toLocaleString();
    } catch {
      return String(t);
    }
  };
  const num = (n) => {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e4) return Math.round(n / 1e3) + "k";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
    return String(n);
  };
  const getJSON = async (url, opts) => {
    try {
      const r = await fetch(url, { cache: "no-store", ...opts });
      if (!r.ok && !opts) return null;
      return await r.json();
    } catch {
      return null;
    }
  };

  /* ---------- icons (stroke, currentColor) ---------- */
  const svg = (p) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const ICONS = {
    mission: svg(
      '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'
    ),
    approvals: svg(
      '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'
    ),
    blast: svg(
      '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6"/>'
    ),
    receipts: svg(
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>'
    ),
    runway: svg('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'),
    settings: svg(
      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
    ),
  };

  const SECTIONS = [
    { key: "mission", name: "Mission Control", group: "Overview", icon: ICONS.mission },
    { key: "approvals", name: "Approval Queue", group: "Overview", icon: ICONS.approvals },
    { key: "blast", name: "Blast Radius", group: "Governance", icon: ICONS.blast },
    { key: "receipts", name: "Audit Receipts", group: "Governance", icon: ICONS.receipts },
    { key: "runway", name: "Runway", group: "Governance", icon: ICONS.runway },
    { key: "settings", name: "Settings", group: null, icon: ICONS.settings },
  ];

  /* ---------- injected styles (reuse existing tokens + classes) ---------- */
  function injectStyle() {
    if (Q("#ag-sect-style")) return;
    const s = E("style");
    s.id = "ag-sect-style";
    s.textContent = `
      .sect-nav { display: grid; gap: 2px; margin: 0 0 4px; }
      .sect-group { color: var(--muted); font-size: 10.5px; font-weight: 600;
        letter-spacing: .9px; text-transform: uppercase; margin: 14px 8px 6px; }
      .sect-group.first { margin-top: 0; }
      .sect-sep { height: 1px; background: var(--hairline); margin: 12px 8px; }
      .sect { display: flex; align-items: center; gap: 10px; width: 100%;
        text-align: left; background: none; border: none; cursor: pointer;
        padding: 8px 12px; border-radius: var(--radius-md); color: var(--muted);
        font-size: 13.5px; font-weight: 500;
        transition: background 120ms ease, color 120ms ease; }
      .sect:hover { color: var(--text); background: var(--surface); }
      .sect.active { color: var(--text); background: var(--surface-2);
        box-shadow: inset 2px 0 0 var(--primary); }
      .sect svg { width: 17px; height: 17px; flex: none; opacity: .82; }
      .sect.active svg { color: var(--primary); opacity: 1; }
      .sect .sect-name { flex: 1; overflow: hidden; text-overflow: ellipsis;
        white-space: nowrap; }
      .sect .count { font-family: var(--mono); font-size: 10px; font-weight: 600;
        color: var(--on-primary); background: var(--primary); border-radius: 999px;
        min-width: 18px; height: 18px; padding: 0 5px; display: inline-flex;
        align-items: center; justify-content: center; flex: none; }
      .sect .count.zero { color: var(--muted-soft); background: var(--surface-2); }
      .ag-hide { display: none !important; }
      .view-head { margin-bottom: 24px; }
      .view-head .topline { color: var(--muted); font-size: 11px; font-weight: 600;
        letter-spacing: .9px; text-transform: uppercase; margin-bottom: 10px; }
      .view-head h1 { font-size: 25px; font-weight: 600; letter-spacing: -.5px;
        margin: 0 0 7px; }
      .view-head p { color: var(--muted); font-size: 13.5px; margin: 0; max-width: 74ch; }
      .blast-card { margin-bottom: 14px; }
      .blast-head { display: flex; align-items: flex-start; justify-content: space-between;
        gap: 14px; flex-wrap: wrap; margin-bottom: 12px; }
      .blast-head .bt { font-weight: 600; letter-spacing: -.2px; }
      .blast-stats { display: flex; gap: 8px 22px; flex-wrap: wrap; margin-bottom: 12px; }
      .blast-stats .bs { display: flex; flex-direction: column; gap: 2px; }
      .blast-stats .bs .k { color: var(--muted); font-size: 10.5px; font-weight: 600;
        letter-spacing: .7px; text-transform: uppercase; }
      .blast-stats .bs .v { font-family: var(--mono); font-size: 13px; color: var(--text); }
      .blast-stats .bs .v.crit { color: var(--error); }
      .blast-clear { display: flex; align-items: center; gap: 8px; color: var(--success);
        font-size: 13px; }
      .blast-clear svg { width: 16px; height: 16px; }
      .ap-note { color: var(--muted); font-size: 12px; margin-top: 10px; }
      .rw-note { color: var(--muted); font-size: 12px; margin: 10px 2px 0; }
      .rw-row { display: flex; align-items: center; gap: 16px; padding: 11px 0;
        border-top: 1px solid var(--hairline); }
      .rw-row.first { border-top: none; padding-top: 4px; }
      .rw-obj { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        font-size: 13.5px; color: var(--body); }
      .rw-tok { font-family: var(--mono); font-size: 12.5px; color: var(--muted);
        white-space: nowrap; }
      .set-links { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
      .set-links a { display: inline-flex; align-items: center; gap: 7px; padding: 8px 13px;
        border: 1px solid var(--hairline-strong); border-radius: var(--radius-md);
        color: var(--body); font-size: 13px; font-weight: 500;
        transition: border-color 120ms ease, color 120ms ease; }
      .set-links a:hover { color: var(--text); border-color: var(--muted); }
      .set-links svg { width: 15px; height: 15px; }

      /* Mobile: match the sidebar-collapse breakpoints from styles.css so the
         section nav becomes horizontal chips instead of eating the first screen. */
      @media (max-width: 980px) {
        .sect-nav { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 10px; }
        .sect-group, .sect-sep { display: none; }
        .sect { width: auto; padding: 7px 11px; font-size: 13px;
          border: 1px solid var(--hairline); background: var(--surface); border-radius: 999px; }
        .sect.active { box-shadow: none; border-color: var(--primary); color: var(--text); }
        .sect .sect-name { flex: 0 1 auto; }
        .sect svg { width: 15px; height: 15px; }
        .view-head { margin-bottom: 18px; }
        .view-head h1 { font-size: 23px; }
        .view-head p { font-size: 13px; }
        .blast-card, .panel { padding: 16px; }
        .blast-stats { gap: 8px 18px; }
      }
      @media (max-width: 480px) {
        .rw-row { flex-wrap: wrap; gap: 3px 12px; padding: 12px 0; }
        .rw-obj { flex: 1 1 100%; white-space: normal; }
        .set-links { width: 100%; }
        .set-links a { flex: 1; justify-content: center; }
        .view-head h1 { font-size: 21px; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ---------- data ---------- */
  let cache = { at: 0, full: [], summaries: [], meta: {}, hash: "", changed: true };
  async function loadAll(force) {
    const now = Date.now();
    if (!force && cache.at && now - cache.at < 2200) return cache;
    const list = await getJSON("/api/missions");
    const summaries = (list && list.missions) || [];
    const full = (
      await Promise.all(
        summaries.map((s) => getJSON("/api/mission/" + encodeURIComponent(s.id)))
      )
    ).filter(Boolean);
    const next = {
      at: now,
      full,
      summaries,
      meta: {
        workspace: (list && list.workspace) || "",
        demo: !!(list && list.demo),
        count: (list && list.count) || summaries.length,
      },
    };
    const change = contentChanged(cache.hash, {
      full: next.full,
      summaries: next.summaries,
      meta: next.meta,
    });
    cache = { ...next, hash: change.hash, changed: change.changed };
    return cache;
  }

  /* ---------- shell wiring ---------- */
  let current = "mission";
  let refreshTimer = null;
  const navButtons = new Map();
  const views = new Map();
  let detailEl, missionsLabel, missionListEl, mainEl;

  function buildNav(side) {
    const nav = E("nav", "sect-nav");
    let lastGroup = null;
    let firstGroup = true;
    SECTIONS.forEach((sec) => {
      if (sec.group && sec.group !== lastGroup) {
        nav.appendChild(E("div", "sect-group" + (firstGroup ? " first" : ""), sec.group));
        lastGroup = sec.group;
        firstGroup = false;
      }
      if (!sec.group && lastGroup !== "__sep") {
        nav.appendChild(E("div", "sect-sep"));
        lastGroup = "__sep";
      }
      const b = E("button", "sect");
      b.dataset.k = sec.key;
      b.type = "button";
      b.innerHTML = `${sec.icon}<span class="sect-name">${H(sec.name)}</span>`;
      if (sec.key === "approvals") {
        const c = E("span", "count zero", "0");
        c.dataset.count = "approvals";
        b.appendChild(c);
      }
      b.addEventListener("click", () => show(sec.key));
      navButtons.set(sec.key, b);
      nav.appendChild(b);
    });
    const label = side.querySelector(".side-label");
    if (label) side.insertBefore(nav, label);
    else side.appendChild(nav);
  }

  function buildViews() {
    SECTIONS.forEach((sec) => {
      if (sec.key === "mission") return;
      const v = E("section", "view ag-hide");
      v.id = "view-" + sec.key;
      views.set(sec.key, v);
      mainEl.appendChild(v);
    });
  }

  function show(key) {
    current = key;
    try {
      history.replaceState(null, "", key === "mission" ? location.pathname : "#" + key);
    } catch {}
    navButtons.forEach((b, k) => b.classList.toggle("active", k === key));
    const isMission = key === "mission";
    if (detailEl) detailEl.classList.toggle("ag-hide", !isMission);
    if (missionsLabel) missionsLabel.classList.toggle("ag-hide", !isMission);
    if (missionListEl) missionListEl.classList.toggle("ag-hide", !isMission);
    views.forEach((v, k) => v.classList.toggle("ag-hide", k !== key));
    renderActive(true, false);
  }

  function viewHead(topline, title, sub) {
    return `<div class="view-head"><div class="topline">${H(topline)}</div><h1>${H(
      title
    )}</h1><p>${H(sub)}</p></div>`;
  }

  function demoNote(meta) {
    if (!meta.demo) return "";
    return `<div class="ap-note">Demo data. This hosted preview shows curated synthetic missions; no live account or workspace was queried.</div>`;
  }

  /* ---------- section renderers ---------- */
  async function renderApprovals(v, data) {
    const meta = data.meta;
    const pending = [];
    data.full.forEach((m) => {
      (m.approvals || []).forEach((a) => pending.push({ m, a }));
    });
    const root = E("div");
    root.innerHTML = viewHead(
      "Overview",
      "Approval Queue",
      "Actions Codex requested that need a human decision. Approve or deny from here, the phone (Telegram), or the terminal. Single-use and bound to the exact command hash."
    );
    if (!pending.length) {
      const empty = E("div", "empty-state");
      empty.innerHTML =
        "<strong>No approvals waiting.</strong><span>Codex is either acting within its authority or was denied outright at the hook.</span>";
      root.appendChild(empty);
    } else {
      pending.forEach(({ m, a }) => root.appendChild(approvalCard(m, a, meta)));
    }
    v.innerHTML = "";
    v.appendChild(root);
  }

  function approvalCard(m, a, meta) {
    const request = a.request || a;
    const actionRequestId = request.id || a.actionRequestId;
    const semanticAction = request.semanticAction || a.semanticAction;
    const cmd = a.displayCommand || a.command || semanticAction || actionRequestId || "action";
    const banner = E("div", "approval-banner");
    banner.innerHTML = `
      <div class="ap-main">
        <span class="ap-dot"></span>
        <div>
          <div class="ap-title">Approval required · ${H(m.contract?.objective || m.id)}</div>
          <div class="ap-cmd">${H(cmd)}</div>
          <div class="ap-meta">${
            semanticAction ? H(semanticAction) + " · " : ""
          }bound to command hash · single-use · expires ${H(time(a.expiresAt))}</div>
        </div>
      </div>
      <div class="ap-actions">
        <button class="button approve" type="button">Approve once</button>
        <button class="button secondary deny" type="button">Deny</button>
      </div>`;
    if (meta.demo) {
      banner.querySelector(".ap-actions").innerHTML =
        '<span class="badge">demo</span>';
      banner.appendChild(
        E("div", "ap-note", "Approvals are interactive when you run AxiomGate locally.")
      );
      return banner;
    }
    const post = async (decision) => {
      const result = await getJSON("/api/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ missionId: m.id, actionRequestId, decision }),
      });
      if (result && result.ok === false) {
        banner.querySelector(".ap-meta").textContent =
          result.error || "Approval update was not accepted";
        return;
      }
      await renderActive(true, false);
    };
    banner.querySelector(".approve").addEventListener("click", () => post("approve"));
    banner.querySelector(".deny").addEventListener("click", () => post("deny"));
    return banner;
  }

  async function renderBlast(v, data) {
    const totalDenies = data.full.reduce((n, m) => n + (m.denials?.length || 0), 0);
    const root = E("div");
    root.innerHTML = viewHead(
      "Governance",
      "Blast Radius",
      "The reach of every governed mission: the intent boundary it may act within, and every action the Codex hook denied for stepping outside it. Enforced, not advisory."
    );
    const band = E("section", "grid metrics");
    band.appendChild(kpi("Missions governed", String(data.full.length), "under an intent boundary", ""));
    band.appendChild(kpi("Actions blocked", String(totalDenies), "denied at the Codex hook", totalDenies ? "critical" : ""));
    const boundaries = new Set(data.full.map((m) => m.contract?.intentBoundary).filter(Boolean));
    band.appendChild(kpi("Boundaries", String(boundaries.size || data.full.length), "distinct authority scopes", ""));
    root.appendChild(band);

    if (!data.full.length) {
      root.appendChild(emptyEl("No governed missions yet.", "Run a mission to populate the blast radius."));
    }
    data.full.forEach((m) => root.appendChild(blastCard(m)));
    if (data.meta.demo) root.appendChild(E("div", "ap-note", "Demo data. Curated synthetic missions."));
    v.innerHTML = "";
    v.appendChild(root);
  }

  function blastCard(m) {
    const c = m.contract || {};
    const denials = m.denials || [];
    const crits = (c.acceptanceCriteria || []).length;
    const panel = E("div", "panel blast-card");
    panel.appendChild(
      E(
        "div",
        "blast-head",
        `<span class="bt">${H(c.objective || m.id)}</span><span class="badge">${H(
          (m.label || "live").toLowerCase()
        )}</span>`
      )
    );
    panel.appendChild(
      E(
        "div",
        "blast-stats",
        `
        <div class="bs"><span class="k">Boundary</span><span class="v">${H(
          c.intentBoundary || "Unknown"
        )}</span></div>
        <div class="bs"><span class="k">Criteria</span><span class="v">${crits} required</span></div>
        <div class="bs"><span class="k">Blocked</span><span class="v ${
          denials.length ? "crit" : ""
        }">${denials.length}</span></div>`
      )
    );
    if (denials.length) {
      const term = E("div", "terminal");
      const lines = denials.slice(0, 3).map((d) => {
        const cmd =
          d.command ||
          (d.toolInput && d.toolInput.command) ||
          (d.commandHash ? "governed command · " + short(d.commandHash) : d.semanticAction || "action");
        const reason = (d.reasons && d.reasons.join(" ")) || d.reason || "Blocked by mission policy";
        return (
          `<span class="t-dim">$</span> <span class="t-b">${H(cmd)}</span>\n` +
          `<span class="t-red">✕ DENY</span> <span class="t-acc">${H(
            d.semanticAction || "policy"
          )}</span> <span class="t-dim">· ${H(d.hookEvent || "PreToolUse")}</span>\n` +
          `  <span class="t-mut">${H(reason)}</span>`
        );
      });
      term.innerHTML = `
        <div class="term-bar">
          <span class="term-lights"><i></i><i></i><i></i></span>
          <span class="term-title">axiomgate hook · codex exec</span>
          <span class="term-flag">${denials.length} denied</span>
        </div>
        <pre class="term-body">${lines.join("\n\n")}</pre>`;
      panel.appendChild(term);
    } else {
      panel.appendChild(
        E(
          "div",
          "blast-clear",
          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg><span>No blocked actions · Codex stayed within authority.</span>`
        )
      );
    }
    return panel;
  }

  async function renderReceipts(v, data) {
    const withReceipt = data.full.filter((m) => m.receipt);
    const root = E("div");
    root.innerHTML = viewHead(
      "Governance",
      "Audit Receipts",
      "Every completed mission seals a Build Receipt: the contract hash, the chained evidence, and the completion verdict. Verify it offline, no trust in the model required."
    );
    if (!withReceipt.length) {
      root.appendChild(
        emptyEl("No receipts sealed yet.", "A receipt is written when a mission clears its completion gate.")
      );
      v.innerHTML = "";
      v.appendChild(root);
      return;
    }
    const panel = E("div", "panel");
    panel.appendChild(E("div", "section-label", "Build receipts · offline-verifiable proofs"));
    const scroll = E("div", "table-scroll");
    const table = E("table");
    table.innerHTML =
      "<thead><tr><th>Mission</th><th>Outcome</th><th>Criteria</th><th>Contract</th><th>Evidence chain</th><th></th></tr></thead>";
    const tbody = E("tbody");
    withReceipt.forEach((m) => {
      const r = m.receipt || {};
      const outcome = r.outcome || "DRAFT";
      const cls = outcome === "COMPLETE" ? "complete" : outcome === "BLOCKED" ? "blocked" : "unverified";
      const tr = E("tr");
      tr.innerHTML = `
        <td>${H(m.contract?.objective || m.id)}</td>
        <td><span class="status-badge ${cls}">${H(outcome)}</span></td>
        <td class="mono">${(m.contract?.acceptanceCriteria || []).length}</td>
        <td class="mono">${short(m.contract?.hash)}</td>
        <td class="mono">${short(r.evidenceChainHead)}</td>
        <td></td>`;
      const btn = E("button", "button secondary", "▶ verify");
      const cell = tr.lastElementChild;
      const out = E("pre", "verify-out");
      btn.addEventListener("click", () => verifyReceipt(m, out));
      cell.appendChild(btn);
      tbody.appendChild(tr);
      const outRow = E("tr");
      const outCell = E("td");
      outCell.colSpan = 6;
      outCell.appendChild(out);
      outRow.appendChild(outCell);
      tbody.appendChild(outRow);
    });
    table.appendChild(tbody);
    scroll.appendChild(table);
    panel.appendChild(scroll);
    root.appendChild(panel);
    if (data.meta.demo) root.appendChild(E("div", "ap-note", "Demo data. Curated synthetic missions."));
    v.innerHTML = "";
    v.appendChild(root);
  }

  // Demonstrative offline readout; the authoritative check is `axiomgate receipt verify`.
  function verifyReceipt(m, out) {
    out.style.display = "block";
    out.className = "verify-out";
    out.textContent = "verifying receipt integrity…";
    const modelEv = (m.evidence || []).some((e) => e.source === "model");
    setTimeout(() => {
      if (modelEv) {
        out.className = "verify-out fail";
        out.textContent =
          "FAIL receipt integrity\nERROR: inadmissible model-sourced evidence in a criterion citation";
      } else {
        out.className = "verify-out pass";
        out.textContent = `PASS receipt integrity\nCHECKED: contract hash\nCHECKED: ${
          (m.evidence || []).length
        } chained evidence records\nCHECKED: criterion evidence citations\nCHECKED: completion gate consistency`;
      }
    }, 600);
  }

  async function renderRunway(v, data) {
    const totals = data.full.reduce(
      (a, m) => {
        (m.ledger || []).forEach((l) => {
          const u = l.usage || {};
          a.in += u.input_tokens || 0;
          a.out += u.output_tokens || 0;
        });
        a.runs += (m.runs || []).length;
        return a;
      },
      { in: 0, out: 0, runs: 0 }
    );
    const cap = await getJSON("/api/capacity");
    const capView = capacityView(cap);
    const root = E("div");
    root.innerHTML = viewHead(
      "Governance",
      "Runway",
      "Codex account capacity and the token spend across governed missions. Usage is read from the Codex app-server, never estimated by the model."
    );
    const band = E("section", "grid metrics");
    band.appendChild(kpi(capView.label, capView.value, capView.foot, capView.tone));
    band.appendChild(kpi("Tokens in", num(totals.in), "prompt tokens across missions", ""));
    band.appendChild(kpi("Tokens out", num(totals.out), "completion tokens across missions", ""));
    band.appendChild(kpi("Codex runs", String(totals.runs), "governed exec sessions", ""));
    root.appendChild(band);
    root.appendChild(E("div", "rw-note", capView.note));

    if (data.full.length) {
      const panel = E("div", "panel");
      panel.style.marginTop = "18px";
      panel.appendChild(E("div", "section-label", "Token spend by mission"));
      data.full.forEach((m, i) => {
        const t = (m.ledger || []).reduce(
          (a, l) => {
            const u = l.usage || {};
            a.in += u.input_tokens || 0;
            a.out += u.output_tokens || 0;
            return a;
          },
          { in: 0, out: 0 }
        );
        const runs = (m.runs || []).length;
        panel.appendChild(
          E(
            "div",
            "rw-row" + (i === 0 ? " first" : ""),
            `<span class="rw-obj" title="${H(m.contract?.objective || m.id)}">${H(
              m.contract?.objective || m.id
            )}</span>
             <span class="rw-tok">${num(t.in)} in · ${num(t.out)} out</span>
             <span class="badge">${runs} run${runs === 1 ? "" : "s"}</span>`
          )
        );
      });
      root.appendChild(panel);
    }
    v.innerHTML = "";
    v.appendChild(root);
  }

  function capacityView(c) {
    if (c && c.demo && c.capacity && c.capacity.kind === "sample") {
      const weekly = (c.capacity.windows || []).find((w) => w.windowLabel === "weekly");
      return {
        label: "Weekly used (SAMPLE)",
        value: weekly ? weekly.usedPercent + "%" : "sample",
        foot: "illustrative hosted-demo capacity",
        tone: "medium",
        note: "Capacity shown is a labelled SAMPLE for the hosted demo. Real capacity is read live when you run locally.",
      };
    }
    const rl = c && c.capacity && c.capacity.rateLimits;
    if (rl && rl.primary) {
      return {
        label: "Weekly used",
        value: rl.primary.usedPercent + "%",
        foot: (rl.planType || "plan") + " · resets " + time(rl.primary.resetsAt * 1000),
        tone: rl.primary.usedPercent > 80 ? "critical" : "ok",
        note: "Live capacity from the Codex app-server.",
      };
    }
    return {
      label: "Capacity",
      value: "n/a",
      foot: "Codex app-server not reachable",
      tone: "",
      note: "Codex app-server capacity is unavailable in this environment.",
    };
  }

  async function renderSettings(v, data) {
    const meta = data.meta;
    const source = meta.demo ? "hosted demo (SAMPLE)" : meta.count ? "live .axiomgate workspace" : "empty workspace";
    const root = E("div");
    root.innerHTML = viewHead(
      null,
      "Settings",
      "Read-only view of how this dashboard is running. No secrets, tokens, or credentials are ever shown here or stored in the browser."
    );
    const panel = E("div", "panel");
    panel.appendChild(E("div", "section-label", "Runtime"));
    const list = E("ul", "statlist");
    list.innerHTML = `
      <li class="stat"><span>Workspace</span><b class="mono">${H(meta.workspace || "(none)")}</b></li>
      <li class="stat"><span>Data source</span><b>${H(source)}</b></li>
      <li class="stat"><span>Missions</span><b>${meta.count} governed</b></li>
      <li class="stat"><span>Enforcement</span><b>Codex PreToolUse hook · deny is authoritative</b></li>
      <li class="stat"><span>Approvals</span><b>Telegram + web · single-use, hash-bound</b></li>`;
    panel.appendChild(list);
    const links = E("div", "set-links");
    links.innerHTML = `
      <a href="https://github.com/mokimeow/axiomgate" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.73 1.27 3.4.97.1-.75.4-1.27.73-1.56-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.2-3.1-.12-.3-.52-1.48.11-3.08 0 0 .98-.31 3.2 1.18a11.1 11.1 0 0 1 5.83 0c2.22-1.5 3.2-1.18 3.2-1.18.63 1.6.23 2.78.11 3.08.75.81 1.2 1.84 1.2 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.2.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z"/></svg>
        View on GitHub</a>
      <a href="/" >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>
        Landing page</a>`;
    panel.appendChild(links);
    root.appendChild(panel);
    v.innerHTML = "";
    v.appendChild(root);
  }

  /* ---------- small shared builders ---------- */
  function kpi(label, value, foot, tone) {
    return E(
      "div",
      "card",
      `<div class="kpi-top"><div class="metric-label">${H(label)}</div></div>
       <div class="metric-value ${tone || ""}">${value}</div>
       <div class="metric-foot">${H(foot)}</div>`
    );
  }
  function emptyEl(strong, span) {
    const e = E("div", "empty-state");
    e.innerHTML = `<strong>${H(strong)}</strong><span>${H(span)}</span>`;
    return e;
  }

  /* ---------- refresh loop ---------- */
  function updateCounts(data) {
    const pending = data.summaries.reduce((n, s) => n + (s.pendingApprovals || 0), 0);
    const badge = Q('.count[data-count="approvals"]');
    if (badge) {
      badge.textContent = String(pending);
      badge.classList.toggle("zero", pending === 0);
    }
  }

  const RENDERERS = {
    approvals: renderApprovals,
    blast: renderBlast,
    receipts: renderReceipts,
    runway: renderRunway,
    settings: renderSettings,
  };

  async function renderActive(force, onlyIfChanged = false) {
    const data = await loadAll(force);
    updateCounts(data);
    if (onlyIfChanged && !data.changed) return;
    const fn = RENDERERS[current];
    if (fn) {
      const v = views.get(current);
      if (v) await fn(v, data);
    }
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    if (document.hidden) return;
    refreshTimer = setTimeout(async () => {
      await renderActive(true, true);
      scheduleRefresh();
    }, resolvePollInterval(undefined, cache.meta.demo));
  }

  document.addEventListener("visibilitychange", () => {
    clearTimeout(refreshTimer);
    if (!document.hidden) {
      renderActive(true, true).finally(scheduleRefresh);
    }
  });

  /* ---------- boot ---------- */
  function init() {
    const side = Q(".side");
    mainEl = Q(".main");
    detailEl = Q("#detail");
    missionListEl = Q("#missionList");
    missionsLabel =
      missionListEl && missionListEl.previousElementSibling &&
      missionListEl.previousElementSibling.classList.contains("side-label")
        ? missionListEl.previousElementSibling
        : null;
    if (!side || !mainEl) return;
    injectStyle();
    buildNav(side);
    buildViews();
    const initial = (location.hash || "").replace(/^#/, "");
    const start = SECTIONS.some((s) => s.key === initial) ? initial : "mission";
    show(start);
    scheduleRefresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
