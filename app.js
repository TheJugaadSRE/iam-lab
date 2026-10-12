(() => {
  const C = window.JUGAAD_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const KEY = "jugaad-iam-lab-v1";
  const state = JSON.parse(localStorage.getItem(KEY) || "{}");
  state.tasks = state.tasks || {};
  state.quiz = state.quiz || {};
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));

  // ---------- lead gate ----------
  function sendLead(type, extra = {}) {
    if (!C.LEAD_ENDPOINT || !state.user) return;
    const body = new URLSearchParams({
      type, source: location.hostname, consent: state.user.consent ? "yes" : "no",
      ...state.user, ...extra
    });
    fetch(C.LEAD_ENDPOINT, { method: "POST", mode: "no-cors", body }).catch(() => {});
  }

  function showApp() {
    $("#gate").style.display = "none";
    $("#app").style.display = "block";
    $("#hello").textContent = state.user.name.split(" ")[0];
    window.scrollTo(0, 0);
    init();
  }

  $("#leadForm").addEventListener("submit", e => {
    e.preventDefault();
    const v = id => $("#" + id).value.trim();
    const err = m => ($("#formErr").textContent = m);
    if (!v("name") || !v("email") || !v("whatsapp") || !v("year") || !v("college") || !v("linkedin")) return err("Please fill all required fields.");
    if (!/^\S+@\S+\.\S+$/.test(v("email"))) return err("Enter a valid email.");
    if (!/^\+?[\d\s-]{10,15}$/.test(v("whatsapp"))) return err("Enter a valid WhatsApp number.");
    if (!/linkedin\.com/i.test(v("linkedin"))) return err("Enter your LinkedIn profile URL.");
    if (!$("#consent").checked) return err("Please tick the consent box to continue.");
    state.user = {
      name: v("name"), email: v("email"), whatsapp: v("whatsapp"),
      year: v("year"), college: v("college"), linkedin: v("linkedin"), consent: true
    };
    save();
    sendLead("signup", { progress: 0 });
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
    $$(".module").forEach(m => {
      const t = $$("[data-task]", m);
      const link = $(`nav.side a[href="#${m.id}"]`);
      if (link && t.length) link.classList.toggle("done", t.every(c => c.checked));
    });
    const ready = p === 100;
    $("#certBtn").disabled = !ready;
    $("#finMsg").textContent = ready
      ? "All tasks done. You just ran a real least-privilege setup. Grab your certificate!"
      : `Complete every task above to unlock your certificate (${pct().done}/${pct().total} done).`;
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
      a.innerHTML = `<span class="dot"></span>${i}. ${m.dataset.title}`;
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

    // tasks
    $$("[data-task]").forEach(c => {
      c.checked = !!state.tasks[c.id];
      c.closest(".task").classList.toggle("checked", c.checked);
      c.addEventListener("change", () => {
        state.tasks[c.id] = c.checked; save();
        c.closest(".task").classList.toggle("checked", c.checked);
        refresh();
        if (pct().p === 100 && !state.doneSent) { state.doneSent = true; save(); sendLead("completed", { progress: 100 }); }
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
    $("#certBtn").addEventListener("click", drawCert);
    refresh();
  }

  // ---------- quiz ----------
  const QUIZ = [
    { q: "A brand-new IAM user with no policies tries to stop an EC2 instance. Result?", o: ["Allowed", "Denied (implicit deny)", "Allowed because the instance is in the same account"], a: 1, w: "IAM is deny-by-default. No Allow = no access." },
    { q: "A user has Allow on ec2:StopInstances in one policy and Deny on it in another. Result?", o: ["Allowed, Allow wins", "Denied, explicit Deny always wins", "Whichever policy was created first"], a: 1, w: "Explicit Deny beats every Allow." },
    { q: "Best way to give 20 interns the same access?", o: ["Attach policy to each user", "Put them in a group and attach the policy to it", "Share one user's password"], a: 1, w: "Groups make permissions manageable and auditable." },
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
      $$(".opt", d).forEach(b => b.onclick = () => { const p = +b.dataset.o; state.quiz[qi] = p; save(); mark(p); });
      if (state.quiz[qi] !== undefined) mark(state.quiz[qi]);
      box.appendChild(d);
    });
  }

  // ---------- links ----------
  function buildLinks() {
    const L = C.LINKS || {};
    const items = [["YouTube", L.youtube], ["LinkedIn", L.linkedin], ["Instagram", L.instagram], ["WhatsApp", L.whatsapp]].filter(x => x[1]);
    const html = items.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${n}</a>`).join("");
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
    g.fillStyle = "#14110f"; g.font = "700 28px Inter, sans-serif"; g.fillText(C.SPEAKER || "Shobhit Verma", 90, 735);
    g.fillStyle = "#6b635d"; g.font = "400 20px Inter, sans-serif"; g.fillText("SRE & Platform Engineering · Creator @TheJugaadSRE", 90, 765);
    $("#certWrap").style.display = "block";
    $("#certDl").href = cv.toDataURL("image/png");
    $("#certWrap").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // sign out / switch user (also via ?reset in the URL)
  const signOut = () => { localStorage.removeItem(KEY); location.replace(location.pathname); };
  if (location.search.includes("reset")) signOut();
  $("#signout").addEventListener("click", e => {
    e.preventDefault();
    if (confirm("Sign out? Your saved progress on this device will be cleared.")) signOut();
  });

  if (state.user) showApp();
})();
