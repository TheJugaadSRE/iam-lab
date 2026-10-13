(() => {
  const C = window.JUGAAD_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const KEY = "jugaad-iam-lab-v1";
  const state = JSON.parse(localStorage.getItem(KEY) || "{}");
  state.tasks = state.tasks || {};
  state.quiz = state.quiz || {};
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));

  // ---------- server helpers ----------
  const LAST = "jugaad-last-user";
  const PKEY = email => "jugaad-progress-" + email.toLowerCase();
  const digits = s => String(s || "").replace(/\D/g, "").slice(-10);

  async function api(params) {
    if (!C.LEAD_ENDPOINT) return null;
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12000);
    try {
      const r = await fetch(C.LEAD_ENDPOINT, { method: "POST", body: new URLSearchParams(params), signal: ctl.signal });
      return await r.json();
    } catch { return null; } finally { clearTimeout(t); }
  }
  const payload = () => ({ ...state.user, consent: "yes", source: location.hostname });

  // ---------- game: points, ranks, toast ----------
  const CERT_AT = 0.75; // share of tasks needed to unlock the certificate
  const RANKS = [[0, "Cloud Rookie"], [0.2, "IAM Apprentice"], [0.45, "Policy Padawan"], [0.7, "Access Architect"], [0.95, "Jugaad SRE Legend"]];
  function score() {
    const ids = $$("[data-task]").map(t => t.id);
    const done = ids.filter(id => state.tasks[id]).length;
    const quizOk = QUIZ.filter((q, i) => state.quiz[i] === q.a).length;
    const max = (ids.length + QUIZ.length) * 5;
    const total = (done + quizOk) * 5;
    let rank = RANKS[0][1];
    RANKS.forEach(([min, name]) => { if (total / max >= min) rank = name; });
    return { done, nTasks: ids.length, quizOk, nQuiz: QUIZ.length, total, max, rank };
  }
  const extras = () => ({
    points: score().total,
    quiz: Object.keys(state.quiz).map(k => k + ":" + state.quiz[k]).join(",")
  });
  let toastT;
  function toast(msg, ms = 1900) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), ms);
  }

  // ---------- TheJugaad World: map, effects, sound ----------
  const CODE = { m1: "1-1", m2: "1-2", m3: "1-3", m4: "1-4", m5: "2-1", m6: "2-2", m7: "2-3", m8: "2-4", m9: "BOSS", m10: "GOAL" };
  const MAPNAME = { m1: "EC2", m2: "Users", m3: "Policy", m4: "Viewer", m5: "MFA", m6: "Roles", m7: "Bonus", m8: "Castle", m9: "Quiz", m10: "Cert" };
  const SND = { coin: [[988, .07], [1319, .18]], win: [[523, .1], [659, .1], [784, .1], [1047, .32]], bad: [[196, .18]] };
  const sndOn = () => localStorage.getItem("jugaad-snd") === "1";
  let audio;
  function beep(notes) {
    if (!sndOn()) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      let t = audio.currentTime;
      notes.forEach(([f, d]) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = "square"; o.frequency.value = f;
        g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
        o.connect(g).connect(audio.destination); o.start(t); o.stop(t + d); t += d * 0.9;
      });
    } catch {}
  }
  function coinFx(el) {
    const r = el.getBoundingClientRect(), d = document.createElement("div");
    d.className = "coinfx"; d.textContent = "🪙 +5";
    d.style.left = r.left + "px"; d.style.top = r.top + "px";
    document.body.appendChild(d); setTimeout(() => d.remove(), 950);
  }
  function confetti() {
    const em = ["🪙", "⭐", "🟧", "🟨", "🎉"];
    for (let i = 0; i < 26; i++) {
      const e = document.createElement("div");
      e.className = "confetti"; e.textContent = em[i % em.length];
      e.style.left = Math.random() * 100 + "vw"; e.style.animationDelay = Math.random() * 0.6 + "s";
      e.style.fontSize = 0.9 + Math.random() * 0.9 + "rem";
      document.body.appendChild(e); setTimeout(() => e.remove(), 3000);
    }
  }
  function celebrate(msg) { toast(msg, 3000); confetti(); beep(SND.win); }

  // original pixel mascot (a hard-hat SRE) drawn from a tiny grid
  function mascotEl() {
    if (mascotEl.el) return mascotEl.el;
    const rows = ["....oooo....", "..oooooooo..", "..oooooooo..", ".hhhhhhhhhh.", "..ssssssss..", "..skssssks..", "..ssssssss..",
      "...ssswss...", "..bbbbbbbb..", ".bbbbbbbbbb.", ".sbbbbbbbbs.", "..bbbbbbbb..", "..hh....hh..", ".hhh....hhh."];
    const col = { o: "#f2561d", h: "#2a2623", s: "#f5c9a0", k: "#000", w: "#fff", b: "#2563eb" };
    let r = "";
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (col[ch]) r += `<rect x="${x * 3}" y="${y * 3}" width="3" height="3" fill="${col[ch]}"/>`; }));
    const d = document.createElement("div"); d.className = "mascot";
    d.innerHTML = `<svg width="36" height="42" viewBox="0 0 36 42" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
    return (mascotEl.el = d);
  }
  function buildWorld() {
    const map = $("#worldMap"); if (!map) return;
    map.innerHTML = '<div class="path">' + Object.keys(CODE).map(id =>
      `<a class="wnode" href="#${id}" data-m="${id}"><span class="dot"></span><span class="lab">${CODE[id]}</span><span class="nm">${MAPNAME[id]}</span></a>`).join("") + "</div>";
  }
  function moduleDone(id) {
    if (id === "m9") return Object.keys(state.quiz).length >= QUIZ.length;
    if (id === "m10") return certUnlocked();
    const t = $$("[data-task]", $("#" + id));
    return t.length > 0 && t.every(c => c.checked);
  }
  function updateWorld() {
    const ids = Object.keys(CODE);
    ids.forEach((id, i) => {
      const n = $(`.wnode[data-m="${id}"]`); if (!n) return;
      const d = moduleDone(id);
      n.classList.toggle("done", d); n.classList.remove("cur");
      $(".dot", n).textContent = d ? "★" : id === "m10" ? "🚩" : id === "m8" ? "🏰" : id === "m9" ? "👾" : i + 1;
    });
    const cur = ids.find(id => !moduleDone(id));
    const node = $(`.wnode[data-m="${cur || "m10"}"]`);
    if (node) { node.classList.add("cur"); node.appendChild(mascotEl()); }
    $("#worldVal").textContent = cur ? CODE[cur] : "GOAL";
    $("#coinsVal").textContent = pct().done;
    $$(".mcoins").forEach(el => {
      const t = $$("[data-task]", $("#" + el.dataset.m));
      el.textContent = "🪙 " + t.filter(c => c.checked).length + "/" + t.length;
    });
  }
  const certReady = () => { const { done, total } = pct(); return done >= Math.ceil(total * CERT_AT); };
  const certUnlocked = () => certReady() && !!state.follow;
  function levelCheck(c) {
    const mod = c.closest(".module"); state.cleared = state.cleared || {};
    const all = $$("[data-task]", mod).every(x => x.checked);
    if (c.checked && all && !state.cleared[mod.id]) { state.cleared[mod.id] = true; save(); celebrate(`🚩 WORLD ${CODE[mod.id] || ""} CLEARED!`); }
    else if (!c.checked && state.cleared[mod.id]) { state.cleared[mod.id] = false; save(); }
    if (certUnlocked() && !state.certFx) { state.certFx = true; save(); celebrate("🎓 CERTIFICATE UNLOCKED!"); }
  }

  function renderScore() {
    const s = score();
    $("#ptsVal").textContent = String(s.total).padStart(5, "0");
    $("#mpts").textContent = s.total + " / " + s.max;
    $("#mrank").textContent = s.rank;
    $("#scoreCard").innerHTML =
      `<div class="big">${s.total} <small style="font-size:1rem;color:#ffd9c7">/ ${s.max} pts</small></div><span class="rk">🏆 ${s.rank}</span>` +
      `<table style="margin-top:.8rem"><tr><td>Tasks completed</td><td>${s.done} / ${s.nTasks} × 5</td><td><b>${s.done * 5}</b></td></tr>` +
      `<tr><td>Quiz answers right</td><td>${s.quizOk} / ${s.nQuiz} × 5</td><td><b>${s.quizOk * 5}</b></td></tr></table>`;
  }

  const doneIds = () => Object.keys(state.tasks).filter(k => state.tasks[k]).join(",");

  // save progress to the sheet (debounced). Also re-creates the row if it is missing.
  let syncT;
  function syncProgress() {
    if (!state.user) return;
    clearTimeout(syncT);
    syncT = setTimeout(() => {
      const p = pct().p;
      api({ type: p === 100 ? "completed" : "progress", ...payload(), progress: p, tasks: doneIds(), ...extras() });
    }, 1500);
  }

  function showApp() {
    $("#gate").style.display = "none";
    $("#app").style.display = "block";
    const first = state.user.name.split(" ")[0];
    $("#hello").textContent = first;
    $("#uname").textContent = "Hi, " + first;
    $("#uav").textContent = first[0].toUpperCase();
    $("#mname").textContent = state.user.name;
    $("#mmail").textContent = state.user.email;
    $("#mcollege").textContent = state.user.college;
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {}
    window.scrollTo(0, 0);
    init();
  }

  // restore progress saved on this device for this email (after sign out)
  function loadBackup(email) {
    try { return JSON.parse(localStorage.getItem(PKEY(email)) || "null"); } catch { return null; }
  }

  // ---------- register / login tabs ----------
  const showTab = name => {
    $("#leadForm").hidden = name !== "reg";
    $("#loginForm").hidden = name !== "log";
  };
  $$(".tabs button").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
  const lastUser = localStorage.getItem(LAST);
  if (lastUser) { $("#lemail").value = lastUser; showTab("log"); }

  const busy = (btn, on, txt) => {
    if (on) { btn.dataset.t = btn.textContent; btn.textContent = txt; } else btn.textContent = btn.dataset.t || btn.textContent;
    btn.disabled = on;
  };

  $("#leadForm").addEventListener("submit", async e => {
    e.preventDefault();
    const v = id => $("#" + id).value.trim();
    const err = m => ($("#formErr").textContent = m);
    if (!v("name") || !v("email") || !v("whatsapp") || !v("year") || !v("college") || !v("linkedin")) return err("Please fill all required fields.");
    if (!/^\S+@\S+\.\S+$/.test(v("email"))) return err("Enter a valid email.");
    if (!/^\+?[\d\s-]{10,15}$/.test(v("whatsapp"))) return err("Enter a valid WhatsApp number.");
    if (!/linkedin\.com/i.test(v("linkedin"))) return err("Enter your LinkedIn profile URL.");
    if (!$("#consent").checked) return err("Please tick the consent box to continue.");
    err("");
    const btn = $("#leadForm button[type=submit]");
    busy(btn, true, "Please wait…");
    state.user = {
      name: v("name"), email: v("email").toLowerCase(), whatsapp: v("whatsapp"),
      year: v("year"), college: v("college"), linkedin: v("linkedin"), consent: true
    };
    const bk = loadBackup(state.user.email);
    if (bk) { state.tasks = bk.tasks || {}; state.quiz = bk.quiz || {}; state.follow = !!bk.follow; }
    save();
    // server de-duplicates by email: an existing email just continues, no second row
    await api({ type: "signup", ...payload(), progress: 0, tasks: doneIds() });
    busy(btn, false);
    showApp();
  });

  $("#loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const err = m => ($("#loginErr").textContent = m);
    const email = $("#lemail").value.trim().toLowerCase(), wa = $("#lwhatsapp").value.trim();
    if (!email || !digits(wa)) return err("Enter your email and WhatsApp number.");
    err("");
    const btn = $("#loginForm button[type=submit]");
    busy(btn, true, "Checking…");
    const r = await api({ type: "login", email, whatsapp: wa });
    const bk = loadBackup(email);
    let user = null, tasks = {}, quiz = {};
    if (r && r.ok) {
      user = { name: r.name, email: r.email, whatsapp: r.whatsapp, college: r.college, year: r.year, linkedin: r.linkedin, consent: true };
      String(r.tasks || "").split(",").filter(Boolean).forEach(id => (tasks[id] = true));
      String(r.quiz || "").split(",").filter(Boolean).forEach(kv => { const [k, v] = kv.split(":"); quiz[k] = +v; });
    } else if (!r && bk && bk.user && digits(bk.user.whatsapp) === digits(wa)) {
      user = bk.user; // server unreachable: fall back to this device's saved copy
    }
    busy(btn, false);
    if (!user) return err(r ? "We couldn't find that email + WhatsApp. Check them, or use Register." : "Couldn't reach the server. Check your internet and try again.");
    state.user = user;
    state.tasks = { ...(bk ? bk.tasks : {}), ...tasks };
    state.follow = !!(bk && bk.follow);
    state.quiz = { ...(bk ? bk.quiz : {}), ...quiz };
    save();
    showApp();
  });

  // ---------- app ----------
  function pct() {
    const t = $$("[data-task]");
    const done = t.filter(c => c.checked).length;
    return { done, total: t.length, p: Math.round((done / t.length) * 100) };
  }

  function refresh() {
    const { p } = pct();
    $("#pfill").style.width = p + "%";
    $("#ptext").textContent = p + "%";
    $("#mprog").textContent = p + "%";
    renderScore();
    updateWorld();
    $$(".module").forEach(m => {
      const t = $$("[data-task]", m);
      const link = $(`nav.side a[href="#${m.id}"]`);
      if (link && t.length) link.classList.toggle("done", t.every(c => c.checked));
    });
    const { done, total } = pct();
    const need = Math.ceil(total * CERT_AT);
    const ready = done >= need, follows = !!state.follow;
    $("#certBtn").disabled = !(ready && follows);
    $("#finMsg").textContent = !ready
      ? `Complete at least ${Math.round(CERT_AT * 100)}% of the tasks to unlock your certificate (${done}/${total} done, ${need - done} to go).`
      : !follows
        ? "Almost there! Follow Shobhit on LinkedIn and Instagram, then tick the box above to unlock your certificate."
        : (p === 100 ? "All tasks done. You just ran a real least-privilege setup. Grab your certificate!" : "Certificate unlocked! You can generate it now, or keep going to boost your score.");
  }

  let inited = false;
  function init() {
    if (inited) return; inited = true;

    // make "What is X?" cards and option tables collapsible to keep pages calm
    $$(".concept, .options").forEach(el => {
      const h = $("h4", el); if (!h) return;
      const d = document.createElement("details");
      d.className = el.className;
      if (el.classList.contains("concept") && !el.closest(".task")) d.open = true;
      const s = document.createElement("summary"); s.textContent = h.textContent;
      const body = document.createElement("div"); body.className = "body";
      h.remove(); while (el.firstChild) body.appendChild(el.firstChild);
      d.append(s, body); el.replaceWith(d);
    });

    // nav
    const nav = $("#side");
    $$(".module").forEach((m, i) => {
      const a = document.createElement("a");
      a.href = "#" + m.id;
      a.innerHTML = `<span class="dot"></span>${CODE[m.id] || "START"} · ${m.dataset.title}`;
      a.onclick = () => toggle(false);
      nav.appendChild(a);
    });
    const scrim = $("#scrim");
    const toggle = open => { nav.classList.toggle("open", open); scrim.classList.toggle("on", open); };
    $("#menuBtn").onclick = () => toggle(!nav.classList.contains("open"));
    scrim.onclick = () => toggle(false);
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) $$("nav.side a").forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id));
    }), { rootMargin: "-30% 0px -60% 0px" });
    $$(".module").forEach(m => io.observe(m));

    // per-world coin counters + map + sound toggle
    $$(".module").forEach(m => {
      if (!$$("[data-task]", m).length) return;
      const s = document.createElement("span"); s.className = "mcoins"; s.dataset.m = m.id;
      const tag = $(".tag", m); if (tag) tag.after(s);
    });
    buildWorld();
    const snd = $("#sndBtn"), paint = () => (snd.textContent = sndOn() ? "🔊" : "🔇");
    snd.onclick = () => { localStorage.setItem("jugaad-snd", sndOn() ? "0" : "1"); paint(); beep(SND.coin); };
    paint();

    // tasks
    $$("[data-task]").forEach(c => {
      c.checked = !!state.tasks[c.id];
      c.closest(".task").classList.toggle("checked", c.checked);
      c.addEventListener("change", () => {
        state.tasks[c.id] = c.checked; save();
        toast(c.checked ? "+5 pts · nice one! ⭐" : "−5 pts");
        if (c.checked) { coinFx(c); beep(SND.coin); }
        c.closest(".task").classList.toggle("checked", c.checked);
        refresh();
        levelCheck(c);
        syncProgress();
      });
    });

    // copy buttons
    $$(".code .copy").forEach(b => b.addEventListener("click", async () => {
      const txt = $("code", b.parentElement).textContent;
      try { await navigator.clipboard.writeText(txt); b.textContent = "Copied ✓"; }
      catch { b.textContent = "Press Ctrl+C"; }
      setTimeout(() => (b.textContent = "Copy"), 1500);
    }));

    buildQuiz();
    buildLinks();
    const fc = $("#followChk"); fc.checked = !!state.follow;
    fc.addEventListener("change", () => {
      state.follow = fc.checked; save(); refresh();
      if (certUnlocked() && !state.certFx) { state.certFx = true; save(); celebrate("🎓 CERTIFICATE UNLOCKED!"); }
      else if (fc.checked) toast("Thanks for following! 🙌");
    });
    $("#certBtn").addEventListener("click", drawCert);
    refresh();
  }

  // ---------- quiz ----------
  const QUIZ = [
    { q: "A brand-new IAM user with no policies tries to stop an EC2 instance. Result?", o: ["Allowed", "Denied (implicit deny)", "Allowed because the instance is in the same account"], a: 1, w: "IAM is deny-by-default. No Allow = no access." },
    { q: "A user has Allow on ec2:StopInstances in one policy and Deny on it in another. Result?", o: ["Allowed, Allow wins", "Denied, explicit Deny always wins", "Whichever policy was created first"], a: 1, w: "Explicit Deny beats every Allow." },
    { q: "Best way to give 20 interns the same access?", o: ["Attach policy to each user", "Put them in a group and attach the policy to it", "Share one user's password"], a: 1, w: "Groups make permissions manageable and auditable." },
    { q: "An intern's password leaks, but his account has MFA. What happens when the thief tries to log in?", o: ["They get in, MFA is optional", "They're stopped at the MFA code, which only the intern's phone can produce", "AWS emails the intern a new password"], a: 1, w: "MFA adds something you have (the phone) on top of something you know (the password)." },
    { q: "Why give the intern a role for prod emergencies instead of permanent prod permissions?", o: ["Roles are free, policies cost money", "Role credentials are temporary and auditable, then access is gone", "Roles can never be denied"], a: 1, w: "Roles hand out short-lived credentials, so elevated access doesn't linger." },
    { q: "Our start/stop policy used the condition aws:ResourceTag/Env = lab. What does it do?", o: ["Limits actions to resources carrying that tag", "Tags every new instance automatically", "Blocks the lab tag"], a: 0, w: "Tag-based conditions are the basis of ABAC." }
  ];
  function buildQuiz() {
    const box = $("#quiz");
    QUIZ.forEach((it, qi) => {
      const d = document.createElement("div"); d.className = "q";
      d.innerHTML = `<p>${qi + 1}. ${it.q}</p>` + it.o.map((t, oi) => `<button class="opt" data-o="${oi}">${t}</button>`).join("") + `<div class="why">${it.w}</div>`;
      const mark = pick => {
        $$(".opt", d).forEach((b, i) => { b.disabled = true; if (i === it.a) b.classList.add("right"); else if (i === pick) b.classList.add("wrong"); });
        $(".why", d).style.display = "block";
      };
      $$(".opt", d).forEach(b => b.onclick = () => { const p = +b.dataset.o; state.quiz[qi] = p; save(); mark(p); refresh(); syncProgress(); toast(p === it.a ? "✅ Correct! +5 pts" : "Not quite, no points"); beep(p === it.a ? SND.coin : SND.bad);
        if (Object.keys(state.quiz).length >= QUIZ.length && !state.bossFx) { state.bossFx = true; save(); celebrate("👾 BOSS DEFEATED!"); } });
      if (state.quiz[qi] !== undefined) mark(state.quiz[qi]);
      box.appendChild(d);
    });
  }

  // ---------- links ----------
  function buildLinks() {
    const L = C.LINKS || {};
    const items = [["YouTube", L.youtube], ["LinkedIn", L.linkedin], ["Instagram", L.instagram], ["WhatsApp", L.whatsapp]].filter(x => x[1]);
    const html = items.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${n}</a>`).join("");
    if (L.linkedin) $("#fLi").href = L.linkedin;
    if (L.instagram) $("#fIg").href = L.instagram;
    $("#socials").innerHTML = items.length ? "Follow <b>TheJugaadSRE</b>: " + html : "";
    $("#footLinks").innerHTML = html;
    if (C.CONTACT_EMAIL) $("#contactMail").innerHTML = `<a href="mailto:${C.CONTACT_EMAIL}">${C.CONTACT_EMAIL}</a>`;
  }

  // ---------- certificate ----------
  async function drawCert() {
    try { await Promise.all([document.fonts.load("700 40px 'Playfair Display'"), document.fonts.load("800 40px Inter")]); } catch {}
    const cv = $("#cert"), g = cv.getContext("2d"), W = cv.width, H = cv.height;
    g.fillStyle = "#fcfaf8"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#ffd9c7"; g.beginPath(); g.moveTo(820, 0); g.lineTo(W, 0); g.lineTo(W, H); g.lineTo(980, H); g.closePath(); g.globalAlpha = .5; g.fill(); g.globalAlpha = 1;
    g.strokeStyle = "#F2561D"; g.lineWidth = 10; g.strokeRect(30, 30, W - 60, H - 60);
    g.fillStyle = "#14110f"; g.textAlign = "left";
    g.font = "800 40px Inter, sans-serif"; g.fillText("TheJugaad", 90, 125);
    const w = g.measureText("TheJugaad").width; g.fillStyle = "#F2561D"; g.fillText("SRE", 90 + w, 125);
    g.fillStyle = "#6b635d"; g.font = "600 22px Inter, sans-serif"; g.fillText("CERTIFICATE OF COMPLETION", 90, 240);
    g.fillStyle = "#14110f"; g.font = "700 84px 'Playfair Display', Georgia, serif";
    let name = state.user.name, fs = 84; while (g.measureText(name).width > 900 && fs > 36) { fs -= 4; g.font = `700 ${fs}px 'Playfair Display', Georgia, serif`; }
    g.fillText(name, 90, 360);
    g.fillStyle = "#3a3430"; g.font = "400 30px Inter, sans-serif";
    g.fillText("completed the hands-on lab", 90, 440);
    g.fillStyle = "#F2561D"; g.font = "700 64px 'Playfair Display', Georgia, serif"; g.fillText("Cloud Security with AWS IAM", 90, 530);
    g.fillStyle = "#3a3430"; g.font = "400 26px Inter, sans-serif";
    g.fillText("EC2 · IAM Users, Groups & Policies · ALLOW vs DENY", 90, 590);
    g.fillText(`${C.EVENT_DATE || ""} · AWS Student Builder Group NMIET`, 90, 630);
    const sc = score(); g.fillStyle = "#b5390b"; g.font = "700 30px Inter, sans-serif"; g.fillText(`Score: ${sc.total} / ${sc.max} pts · ${sc.rank}`, 90, 690);
    g.fillStyle = "#6b635d"; g.font = "400 20px Inter, sans-serif"; g.fillText("SRE & Platform Engineering · Creator @TheJugaadSRE", 90, 765);
    g.fillStyle = "#6b635d"; g.font = "600 18px Inter, sans-serif"; g.fillText("TheJugaad World · AWS IAM Edition · A game by Shobhit Verma", 90, 800);
    $("#certWrap").style.display = "block";
    $("#certDl").href = cv.toDataURL("image/png");
    $("#certWrap").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // sign out / switch user (also via ?reset in the URL)
  const signOut = () => {
    if (state.user) {
      localStorage.setItem(PKEY(state.user.email), JSON.stringify({ user: state.user, tasks: state.tasks, quiz: state.quiz, follow: state.follow }));
      localStorage.setItem(LAST, state.user.email);
    }
    localStorage.removeItem(KEY);
    location.replace(location.pathname);
  };
  if (location.search.includes("reset")) signOut();
  $("#signout").addEventListener("click", e => { e.preventDefault(); signOut(); });

  // user dropdown
  const menu = $("#menu"), ubtn = $("#userBtn");
  const setMenu = open => { menu.hidden = !open; ubtn.setAttribute("aria-expanded", open); };
  ubtn.addEventListener("click", e => { e.stopPropagation(); setMenu(menu.hidden); });
  menu.addEventListener("click", e => { if (e.target.closest("a.mi:not(.out)")) setMenu(false); });
  document.addEventListener("click", e => { if (!e.target.closest("#userMenu")) setMenu(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });

  // gate: top-right Login button opens the login tab
  $("#loginBtn").addEventListener("click", () => { showTab("log"); $("#loginForm").scrollIntoView({ behavior: "smooth", block: "center" }); $("#lemail").focus(); });

  if (state.user) showApp();
})();
