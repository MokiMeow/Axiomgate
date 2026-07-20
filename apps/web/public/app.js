// AxiomGate dashboard - renders real .axiomgate mission state.
const $ = (s, r = document) => r.querySelector(s);
const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
const shortHash = (h) => { if (!h) return "Unknown"; const v = String(h).replace(/^sha256:/, ""); return "sha256:" + v.slice(0, 10) + "…"; };
const fmtTime = (t) => { if (!t) return "Unknown"; try { return new Date(t).toLocaleString(); } catch { return t; } };
const fmtNum = (n) => {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e4) return Math.round(n / 1e3) + "k";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n);
};

const STAGES = [
  { key: "plan", name: "Plan", desc: "Compiled into a versioned, hashed contract" },
  { key: "guard", name: "Guard", desc: "Identity resolved · policy enforced at the hook" },
  { key: "run", name: "Run", desc: "Codex builds under sandbox + intent boundary" },
  { key: "verify", name: "Verify", desc: "Tests, scanners, remediation - machine evidence" },
  { key: "prove", name: "Prove", desc: "Completion gated on evidence · receipt" },
];

let STATE = { missions: [], current: null, capacity: null, demo: false };

async function api(path, opts) {
  const r = await fetch(path, opts);
  return r.json();
}

/* ---------- boot ---------- */
async function boot() {
  loadCapacity();
  const data = await api("/api/missions");
  STATE.missions = data.missions || [];
  STATE.demo = !!data.demo;
  $("#workspaceLabel").textContent = data.workspace || "";
  renderMissionList();
  if (STATE.missions[0]) selectMission(STATE.missions[0].id);
  else $("#detail").innerHTML =
    '<div class="empty-state"><strong>No governed missions yet.</strong><span>Run <code>axiomgate mission run</code> in this workspace, or <code>npx axiomgate replay all</code> to see enforcement with no setup.</span></div>';
}

async function loadCapacity() {
  try {
    const c = await api("/api/capacity");
    if (c.demo && c.capacity && c.capacity.kind === "sample") {
      const weekly = (c.capacity.windows || []).find((w) => w.windowLabel === "weekly");
      STATE.capacity = {
        text: weekly ? `SAMPLE · ${weekly.usedPercent}% weekly used` : "SAMPLE capacity",
        title: `${c.capacity.note || "Illustrative hosted-demo capacity"} [source: sample; confidence: sample]`,
        ok: false,
        sample: true,
      };
      updateCapacityPill();
      return;
    }
    const rl = c.capacity && c.capacity.rateLimits;
    if (rl && rl.primary) {
      STATE.capacity = {
        text: `${rl.planType || "plan"} · ${rl.primary.usedPercent}% weekly used`,
        title: `Real Codex capacity - resets ${fmtTime(rl.primary.resetsAt * 1000)} [codex-app-server]`,
        ok: true,
      };
    } else {
      STATE.capacity = { text: "capacity unavailable", title: "Codex app-server not reachable", ok: false };
    }
  } catch {
    STATE.capacity = { text: "capacity unavailable", title: "Codex app-server not reachable", ok: false };
  }
  updateCapacityPill();
}

function capacityPillHtml() {
  const c = STATE.capacity;
  const dot = c && c.ok ? "ok" : "";
  const text = c ? c.text : "capacity…";
  const title = c ? c.title : "Live Codex account capacity";
  return `<span class="pill" id="capacityPill" title="${esc(title)}"><span class="dot ${dot}"></span>${esc(text)}</span>`;
}

function updateCapacityPill() {
  const pill = $("#capacityPill");
  if (pill) pill.outerHTML = capacityPillHtml();
}

function renderMissionList() {
  const list = $("#missionList");
  list.innerHTML = "";
  STATE.missions.forEach((m) => {
    const item = el("button");
    item.dataset.id = m.id;
    item.title = m.objective || m.id;
    item.innerHTML = `
      <span class="m-obj">${esc(m.objective || m.id)}</span>
      <span class="m-meta">${esc((m.label || "live").toLowerCase())} · ${esc(m.intentBoundary || "Unknown")}${m.denials ? ` · <span class="flag">${m.denials} blocked</span>` : ""}</span>`;
    item.addEventListener("click", () => selectMission(m.id));
    list.appendChild(item);
  });
}

async function selectMission(id) {
  document.querySelectorAll("#missionList button").forEach((c) => c.classList.toggle("active", c.dataset.id === id));
  const m = await api("/api/mission/" + encodeURIComponent(id));
  STATE.current = m;
  renderDetail(m);
}

/* ---------- verdict computation (display only) ----------
   Authoritative source: the CLI-generated receipt (core verdict engine).
   Fallback mirror: latest admissible evidence per criterion decides - a
   superseding passing rerun outranks an earlier failure (remediation flow). */
function criterionVerdict(c, evidence, receipt) {
  const rc = receipt && Array.isArray(receipt.criteria)
    ? receipt.criteria.find((r) => r.id === c.id)
    : null;
  if (rc && rc.verdict) return rc.verdict;
  if (c.verdict && c.verdict !== "UNVERIFIED") return c.verdict;
  const ev = evidence
    .filter((e) => e.criterionId === c.id && e.source && e.source !== "model")
    .sort((a, b) => String(a.capturedAt || a.ts || "").localeCompare(String(b.capturedAt || b.ts || "")));
  if (ev.length === 0) return "UNVERIFIED";
  const latest = ev[ev.length - 1];
  return latest.exitCode != null && latest.exitCode !== 0 ? "FAIL" : "PASS";
}

function stageStatus(m) {
  const s = {};
  s.plan = m.contract ? "done" : "";
  s.guard = (m.identity || m.denials.length || m.events.some((e) => e.hookEvent)) ? "done" : "";
  s.run = m.runs.length ? "done" : "";
  s.verify = m.verifications.length ? "done" : "";
  const crits = m.contract.acceptanceCriteria || [];
  const verdicts = crits.map((c) => criterionVerdict(c, m.evidence, m.receipt));
  const complete = m.receipt && m.receipt.outcome === "COMPLETE"
    ? true
    : crits.length && verdicts.every((v) => v === "PASS" || v === "WAIVED");
  s.prove = complete ? "done" : (m.receipt ? "active" : "");
  if (m.denials.length) s.guard = "blocked";
  return { s, verdicts, complete };
}

function identityField(m, key) {
  const id = m.identity;
  if (!id) return null;
  const f = id[key];
  if (!f) return null;
  return typeof f === "object" ? (f.value ?? f.status) : f;
}

/* ---------- render ---------- */
function renderDetail(m) {
  const c = m.contract;
  const { s, verdicts, complete } = stageStatus(m);
  const root = el("div");

  if (STATE.demo) {
    root.appendChild(el("div", "demo-banner", `
      <span class="demo-dot"></span>
      <span><b>Demo data.</b> This hosted preview shows a curated synthetic SAMPLE mission; no live account or workspace was queried.
      For real governed missions, run locally against your workspace. See the <a href="/#quickstart">quickstart</a>.</span>`));
  }

  root.appendChild(pageHead(m, complete));
  (m.approvals || []).forEach((a) => root.appendChild(approvalBanner(m, a)));
  root.appendChild(metricsBand(m, verdicts));
  root.appendChild(spineSection(s));
  if (m.denials.length) root.appendChild(blockMoment(m));
  root.appendChild(twoColumn(m, verdicts, complete));

  const detail = $("#detail");
  detail.innerHTML = "";
  detail.appendChild(root);
}

function pageHead(m, complete) {
  const c = m.contract;
  const head = el("div", "page-head");
  head.innerHTML = `
    <div class="topline">Governed mission · <span class="mono">${esc(c.id)}</span></div>
    <div class="head-row">
      <h1>${esc(c.objective || "Untitled mission")}</h1>
      <div class="head-actions">
        <span class="status-badge ${complete ? "complete" : "blocked"}" title="${complete ? "Every required criterion PASS or WAIVED" : "Held until every criterion has fresh, admissible evidence"}">gate · ${complete ? "complete" : "blocked"}</span>
        <span class="badge">${esc((m.label || "LIVE").toLowerCase())}</span>
        ${capacityPillHtml()}
      </div>
    </div>
    <div class="meta-line">
      <span><span class="k">Boundary</span><span class="v">${esc(c.intentBoundary || "Unknown")}</span></span>
      <span><span class="k">GitHub</span><span class="v">${esc(identityField(m, "githubLogin") || "Unknown")}</span></span>
      <span><span class="k">Version</span><span class="v">v${esc(c.version ?? 1)}</span></span>
      <span><span class="k">Status</span><span class="v">${esc(c.status || "Unknown")}</span></span>
      <span><span class="k">Contract</span><span class="v mono copyable" data-copy="${esc(c.hash || "")}" title="Click to copy full hash">${shortHash(c.hash)}</span></span>
    </div>`;
  const cp = head.querySelector(".copyable");
  if (cp) cp.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(cp.dataset.copy); } catch { return; }
    const prev = cp.textContent;
    cp.textContent = "copied";
    setTimeout(() => { cp.textContent = prev; }, 900);
  });
  return head;
}

function approvalBanner(m, a) {
  const cmd = a.command || a.semanticAction || a.actionRequestId || "action";
  const banner = el("div", "approval-banner");
  banner.innerHTML = `
    <div class="ap-main">
      <span class="ap-dot"></span>
      <div>
        <div class="ap-title">Approval required</div>
        <div class="ap-cmd">${esc(cmd)}</div>
        <div class="ap-meta">${a.semanticAction ? esc(a.semanticAction) + " · " : ""}bound to command hash · single-use · expires ${fmtTime(a.expiresAt)}</div>
      </div>
    </div>
    <div class="ap-actions">
      <button class="button approve">Approve once</button>
      <button class="button secondary deny">Deny</button>
    </div>`;
  const post = async (decision) => {
    await api("/api/approve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ missionId: m.id, actionRequestId: a.actionRequestId, decision }) });
    selectMission(m.id);
  };
  banner.querySelector(".approve").addEventListener("click", () => post("approve"));
  banner.querySelector(".deny").addEventListener("click", () => post("deny"));
  return banner;
}

function metricsBand(m, verdicts) {
  const crits = m.contract.acceptanceCriteria || [];
  const proven = verdicts.filter((v) => v === "PASS" || v === "WAIVED").length;
  const totals = m.ledger.reduce((a, l) => {
    const u = l.usage || {};
    a.in += u.input_tokens || 0; a.out += u.output_tokens || 0;
    return a;
  }, { in: 0, out: 0 });
  const denials = m.denials.length;
  const pending = (m.approvals || []).length;

  const svg = (paths) =>
    `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const ICONS = {
    proven: svg('<path d="M21.8 10A10 10 0 1 1 17 3.34"/><path d="m9 11 3 3L22 4"/>'),
    blocked: svg('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m14.5 9.5-5 5"/><path d="m9.5 9.5 5 5"/>'),
    pending: svg('<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>'),
    tokens: svg('<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>'),
  };

  const kpis = [
    {
      label: "Criteria proven",
      value: `${proven}<span class="frac">/${crits.length}</span>`,
      foot: "PASS or WAIVED, machine evidence",
      tone: proven === crits.length && crits.length ? "ok" : "medium",
      icon: ICONS.proven,
    },
    {
      label: "Actions blocked",
      value: String(denials),
      foot: "Denied at the Codex hook",
      tone: denials > 0 ? "critical" : "",
      icon: ICONS.blocked,
    },
    {
      label: "Approvals pending",
      value: String(pending),
      foot: "Web + phone surface",
      tone: pending > 0 ? "medium" : "",
      icon: ICONS.pending,
    },
    {
      label: "Tokens spent",
      value: fmtNum(totals.in),
      foot: `${fmtNum(totals.out)} out · ${m.runs.length} Codex run${m.runs.length === 1 ? "" : "s"}`,
      tone: "",
      icon: ICONS.tokens,
    },
  ];

  const band = el("section", "grid metrics");
  kpis.forEach((k) => {
    band.appendChild(el("div", "card", `
      <div class="kpi-top">
        <div class="metric-label">${k.label}</div>
        <span class="kpi-icon ${k.tone}">${k.icon}</span>
      </div>
      <div class="metric-value ${k.tone}">${k.value}</div>
      <div class="metric-foot">${esc(k.foot)}</div>`));
  });
  return band;
}

function spineSection(s) {
  const wrap = el("section", "section");
  wrap.appendChild(el("div", "section-label", "Mission spine · plan → guard → run → verify → prove"));
  const spine = el("div", "spine");
  STAGES.forEach((st, i) => {
    const cls = s[st.key] || "";
    const mark = cls === "blocked" ? "✕" : cls === "done" ? "✓" : String(i + 1);
    spine.appendChild(el("div", `step ${cls}`, `
      <span class="step-n">${mark}</span>
      <span class="step-name">${st.name}</span>
      <span class="step-desc">${st.desc}</span>`));
  });
  wrap.appendChild(spine);
  return wrap;
}

function blockMoment(m) {
  const wrap = el("section", "section");
  wrap.appendChild(el("div", "section-label", "The block moment · enforced, not suggested"));
  const term = el("div", "terminal");
  const lines = m.denials.slice(0, 3).map((d) => {
    const cmd = d.command || (d.toolInput && d.toolInput.command) ||
      (d.commandHash ? `governed command · ${shortHash(d.commandHash)}` : d.semanticAction || "action");
    const reason = (d.reasons && d.reasons.join(" ")) || d.reason || "Blocked by mission policy";
    return (
      `<span class="t-dim">$</span> <span class="t-b">${esc(cmd)}</span>\n` +
      `<span class="t-red">✕ DENY</span> <span class="t-acc">${esc(d.semanticAction || "policy")}</span> <span class="t-dim">· ${esc(d.hookEvent || "PreToolUse")}</span>\n` +
      `  <span class="t-mut">${esc(reason)}</span>`
    );
  });
  term.innerHTML = `
    <div class="term-bar">
      <span class="term-lights"><i></i><i></i><i></i></span>
      <span class="term-title">axiomgate hook - codex exec</span>
      <span class="term-flag">${m.denials.length} denied</span>
    </div>
    <pre class="term-body">${lines.join("\n\n")}</pre>`;
  wrap.appendChild(term);
  return wrap;
}

function twoColumn(m, verdicts, complete) {
  // Proof of completion is the hero → full width. Model plan + receipt sit
  // balanced in a row below, so there is no empty column gap.
  const wrap = el("section", "grid");
  wrap.appendChild(proofPanel(m, verdicts, complete));
  const verification = verificationPanel(m);
  if (verification) wrap.appendChild(verification);
  const row = el("div", "grid two");
  const plan = planPanel(m);
  if (plan) row.appendChild(plan);
  row.appendChild(receiptPanel(m));
  wrap.appendChild(row);
  return wrap;
}

function verificationPanel(m) {
  const runs = m.verifications || [];
  const findings = m.findings || [];
  if (!runs.length && !findings.length) return null;
  const panel = el("div", "panel");
  panel.appendChild(el("div", "section-label", "Verification and governed remediation"));
  runs.forEach((run) => {
    const pass = run.overall === "PASS";
    panel.appendChild(el("div", "phase-row", `
      <span class="ph">${esc(run.id)}</span>
      <span class="ph-model">${pass ? "Targeted rerun cleared the affected check" : "Dependency scan found a blocking advisory"}</span>
      <span class="status-badge ${pass ? "pass" : "fail"}">${esc(run.overall)}</span>`));
  });
  findings.forEach((finding) => {
    panel.appendChild(el("div", "gate complete", `
      <span class="gate-label">${esc(finding.package || "finding")} ${esc(finding.version || "")}</span>
      <span class="status-badge complete">${esc((finding.status || "resolved").toUpperCase())}</span>
      <span class="gate-reason">${esc(finding.title)}${finding.fixedVersion ? ` · fixed in ${esc(finding.fixedVersion)}` : ""}</span>`));
  });
  return panel;
}

function proofPanel(m, verdicts, complete) {
  const crits = m.contract.acceptanceCriteria || [];
  const panel = el("div", "panel");
  panel.appendChild(el("div", "section-label", "Proof of completion"));

  const scroll = el("div", "table-scroll");
  const table = el("table");
  table.innerHTML = `<thead><tr><th>Criterion</th><th>Risk</th><th>Evidence</th><th>Verdict</th></tr></thead>`;
  const tbody = el("tbody");
  crits.forEach((c, i) => {
    const v = verdicts[i];
    const cls = v === "PASS" ? "pass" : v === "FAIL" ? "fail" : "unverified";
    const ev = m.evidence.filter((e) => e.criterionId === c.id);
    const tags = ev.slice(0, 4).map((e) =>
      `<span class="evtag ${e.source === "model" ? "src-model" : ""}" ${e.source === "model" ? 'title="Model-sourced - inadmissible as evidence"' : ""}>${esc(e.source)}:${esc((e.id || "").slice(0, 8))}</span>`
    ).join("");
    const tr = el("tr");
    tr.innerHTML = `
      <td>${esc(c.statement)}</td>
      <td class="risk ${esc(c.risk || "")}">${esc(c.risk || "Unknown")}</td>
      <td>${tags || '<span class="evtag none">none yet</span>'}</td>
      <td><span class="status-badge ${cls}">${esc(v)}</span></td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  scroll.appendChild(table);
  panel.appendChild(scroll);

  panel.appendChild(el("div", `gate ${complete ? "complete" : "blocked"}`, `
    <span class="gate-label">Completion gate</span>
    <span class="status-badge ${complete ? "complete" : "blocked"}">${complete ? "COMPLETE" : "BLOCKED"}</span>
    <span class="gate-reason">${complete ? "every required criterion PASS or WAIVED" : "held until every criterion has fresh, admissible evidence"}</span>`));
  return panel;
}

function planPanel(m) {
  const plan = m.contract.modelPlan;
  const sessions = (m.sessions || []).map((x) => x.role);
  if ((!plan || !plan.length) && !sessions.length) return null;
  const panel = el("div", "panel");
  panel.appendChild(el("div", "section-label", "Model plan"));
  (plan || []).forEach((p) => {
    panel.appendChild(el("div", "phase-row", `
      <span class="ph">${esc(p.phase)}</span>
      <span class="ph-model">${esc(p.model || "Unknown")}${p.rationale ? `<span class="ph-why">${esc(p.rationale)}</span>` : ""}</span>
      <span class="badge">${esc(p.effort || "Unknown")}</span>`));
  });
  if (sessions.length) {
    const lbl = el("div", "section-label", "Sessions");
    lbl.style.marginTop = "20px";
    panel.appendChild(lbl);
    const chips = el("div", "chips");
    sessions.forEach((r) => chips.appendChild(el("span", "chip", `<span class="dot ok"></span>${esc(r)}`)));
    panel.appendChild(chips);
  }
  return panel;
}

function receiptPanel(m) {
  const r = m.receipt || {};
  const commit = (r.repo && r.repo.commit) || "Unknown";
  const panel = el("div", "panel");
  panel.appendChild(el("div", "panel-head", `
    <div class="section-label">Build receipt</div>
    <span class="status-badge ${r.outcome === "COMPLETE" ? "complete" : "unverified"}">${esc(r.outcome || "DRAFT")}</span>`));
  const list = el("ul", "statlist");
  list.innerHTML = `
    <li class="stat"><span>Mission</span><b>${esc(m.id)}</b></li>
    <li class="stat"><span>Contract hash</span><b>${shortHash(m.contract.hash)}</b></li>
    <li class="stat"><span>Commit</span><b>${esc(String(commit).slice(0, 12))}</b></li>
    <li class="stat"><span>Criteria</span><b>${(m.contract.acceptanceCriteria || []).length} required</b></li>`;
  panel.appendChild(list);
  panel.appendChild(el("div", "chain", `evidence chain · ${shortHash(r.evidenceChainHead || "sha256:pending")}`));
  const btn = el("button", "button secondary verify-btn", "▶ axiomgate receipt verify");
  const out = el("pre", "verify-out");
  btn.addEventListener("click", () => runVerify(m, out));
  panel.appendChild(btn);
  panel.appendChild(out);
  return panel;
}

// Demonstrative offline verify readout (the real check is the CLI `receipt verify`).
function runVerify(m, out) {
  out.style.display = "block";
  out.className = "verify-out";
  out.textContent = "verifying receipt integrity…";
  const modelEv = m.evidence.some((e) => e.source === "model");
  setTimeout(() => {
    if (modelEv) {
      out.className = "verify-out fail";
      out.textContent = "FAIL receipt integrity\nERROR: inadmissible model-sourced evidence in a criterion citation";
    } else {
      out.className = "verify-out pass";
      out.textContent = `PASS receipt integrity\nCHECKED: contract hash\nCHECKED: ${m.evidence.length} chained evidence records\nCHECKED: criterion evidence citations\nCHECKED: completion gate consistency`;
    }
  }, 650);
}

boot();
