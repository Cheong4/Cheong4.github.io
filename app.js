// data.json 을 읽어 화면을 그립니다. (내용 수정은 data.json 만 하면 됩니다)
const $ = (id) => document.getElementById(id);
const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 연혁 탭이 시작되는 연도. 이 연도부터 현재 연도까지 탭이 자동으로 만들어집니다.
const HISTORY_START_YEAR = 2025;

fetch("data.json")
  .then((r) => {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  })
  .then(render)
  .catch((e) => {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<pre style="color:#ff6b6b;padding:20px">data.json 을 불러오지 못했습니다.\n로컬에서는 'python -m http.server' 로 실행하세요.\n${esc(e.message)}</pre>`
    );
  });

function render(d) {
  document.title = d.name;
  $("brand").textContent = `${d.name}@site:~$`;
  $("desc").textContent = d.desc;
  $("about-text").textContent = d.about;
  $("contact-text").innerHTML = d.contact
    .map((c) => `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.label)}</a>`)
    .join(" · ");

  typeWriter(d.slogan, $("typed"));

  $("stats").innerHTML = d.stats
    .map((s) => `<div class="stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`)
    .join("");

  loadRanking();

  $("tags").innerHTML = d.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("");

  renderHistory(d.history || []);

  $("grid").innerHTML = d.members
    .map((m) => {
      const avatar = m.photo
        ? `<img class="avatar" src="${esc(m.photo)}" alt="${esc(m.name)}">`
        : `<div class="avatar">${esc(m.name.slice(0, 1))}</div>`;
      const skills = (m.skills || []).map((s) => `<span>${esc(s)}</span>`).join("");
      const links = Object.entries(m.links || {})
        .map(([k, v]) => `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(k)}</a>`)
        .join("");
      return `<article class="card">${avatar}<h3>${esc(m.name)}</h3><div class="role">${esc(m.role)}</div>
        <p class="bio">${esc(m.bio)}</p><div class="skills">${skills}</div><div class="links">${links}</div></article>`;
    })
    .join("");

  setupNav();
}

/* ---------- 네비게이션: 해시 이동 + 현재 섹션 하이라이트 ---------- */
// blog/news 에서 ./#members 로 넘어오면 내용이 그려진 뒤에야 섹션이 생기므로, 렌더 후에 직접 스크롤합니다.
function setupNav() {
  const ids = ["about", "history", "members", "contact"];
  const links = {};
  document.querySelectorAll(".top nav a").forEach((a) => {
    const m = /#(\w+)$/.exec(a.getAttribute("href") || "");
    if (m && ids.includes(m[1])) links[m[1]] = a;
  });

  const m = /^#(about|history|members|contact)/.exec(location.hash);
  if (m && !/^#history-/.test(location.hash)) {
    const el = $(m[1]);
    const go = () => el && el.scrollIntoView({ behavior: "instant" });
    if (el) {
      go();
      // 이미지/폰트 로드로 레이아웃이 밀릴 수 있어 로드 후 한 번 더 맞춥니다.
      // 통계 카드(랭킹)·타이핑으로 위쪽 높이가 변하므로, 사용자가 스크롤하기 전까지 잠깐 위치를 유지합니다.
      let n = 0;
      const stop = () => clearInterval(t);
      const t = setInterval(() => (++n > 25 ? stop() : go()), 150);
      ["wheel", "touchstart", "keydown", "mousedown"].forEach((ev) =>
        window.addEventListener(ev, stop, { once: true, passive: true })
      );
    }
  }

  // 메뉴를 눌러 이동한 직후에는 누른 메뉴를 그대로 강조합니다. (members 는 페이지 끝이라 contact 와 겹쳐 보이기 때문)
  let forced = m && !/^#history-/.test(location.hash) ? m[1] : "";
  const unforce = () => {
    if (forced) { forced = ""; spy(); }
  };
  Object.keys(links).forEach((id) => links[id].addEventListener("click", () => { forced = id; spy(); }));
  ["wheel", "touchmove", "keydown", "mousedown"].forEach((ev) =>
    window.addEventListener(ev, (e) => { if (!(e.target.closest && e.target.closest(".top nav"))) unforce(); }, { passive: true })
  );

  function spy() {
    if (forced) {
      ids.forEach((id) => links[id] && links[id].classList.toggle("on", id === forced));
      return;
    }
    const line = (document.querySelector(".top")?.offsetHeight || 0) + 60;
    let cur = "";
    ids.forEach((id) => {
      const el = $(id);
      if (el && el.getBoundingClientRect().top <= line) cur = id;
    });
    // 페이지 맨 아래면 마지막(contact) 강조
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = "contact";
    ids.forEach((id) => links[id] && links[id].classList.toggle("on", id === cur));
  }
  window.addEventListener("scroll", spy, { passive: true });
  window.addEventListener("resize", spy);
  spy();
}

/* ---------- 연혁: 연도 탭 ---------- */
function renderHistory(raw) {
  // date 는 "YYYY.MM" 형식. 연도를 읽을 수 없는 항목은 '전체' 탭에서만 보입니다.
  const items = raw.map((h) => {
    const m = /^(\d{4})(?:\.(\d{1,2}))?/.exec(h.date || "");
    return { ...h, year: m ? Number(m[1]) : null, month: m && m[2] ? Number(m[2]) : 0 };
  });
  items.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.month - b.month); // 오래된 순

  const dataMax = Math.max(0, ...items.map((h) => h.year || 0));
  const lastYear = Math.max(new Date().getFullYear(), dataMax);

  const tabs = [];
  for (let y = HISTORY_START_YEAR; y <= lastYear; y++) {
    tabs.push({ key: String(y), label: String(y), count: items.filter((h) => h.year === y).length });
  }
  tabs.push({ key: "all", label: "전체", count: items.length });

  const tablist = $("year-tabs");
  tablist.innerHTML = tabs
    .map(
      (t) =>
        `<button type="button" class="tab${t.count ? "" : " zero"}" role="tab" id="tab-${t.key}" data-key="${t.key}" aria-controls="log">${esc(t.label)}<span class="n">${t.count}</span></button>`
    )
    .join("");

  const buttons = [...tablist.querySelectorAll(".tab")];

  function select(key, { focus = false, updateHash = true } = {}) {
    buttons.forEach((b) => {
      const on = b.dataset.key === key;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    $("log").setAttribute("aria-labelledby", "tab-" + key);
    $("log").innerHTML = historyHTML(items, key);
    if (updateHash) history.replaceState(null, "", "#history-" + key);
  }

  tablist.addEventListener("click", (e) => {
    const b = e.target.closest(".tab");
    if (b) select(b.dataset.key);
  });

  tablist.addEventListener("keydown", (e) => {
    const i = buttons.findIndex((b) => b.getAttribute("aria-selected") === "true");
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % buttons.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + buttons.length) % buttons.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = buttons.length - 1;
    if (n >= 0) {
      e.preventDefault();
      select(buttons[n].dataset.key, { focus: true });
    }
  });

  // 초기 선택: URL 해시(#history-2025) → 현재 연도 → 마지막 연도
  const fromHash = /^#history-(\d{4}|all)$/.exec(location.hash);
  const validKeys = tabs.map((t) => t.key);
  const currentYear = String(new Date().getFullYear());
  const initial =
    fromHash && validKeys.includes(fromHash[1])
      ? fromHash[1]
      : validKeys.includes(currentYear)
      ? currentYear
      : tabs[tabs.length - 2].key;

  select(initial, { updateHash: false });
  if (fromHash) $("history").scrollIntoView();
}

function historyHTML(items, key) {
  const list = key === "all" ? items : items.filter((h) => String(h.year) === key);
  if (!list.length) return `<li class="empty">이 해에는 등록된 기록이 없습니다.</li>`;

  let html = "";
  let prev;
  list.forEach((h) => {
    if (key === "all" && h.year !== prev) {
      html += `<li class="year-head">${h.year ?? "날짜 미정"}</li>`;
      prev = h.year;
    }
    html += `<li><time>${esc(h.date)}</time><h3>${esc(h.title)}</h3><p>${esc(h.desc)}</p></li>`;
  });
  return html;
}

function typeWriter(text, el, i = 0) {
  if (i > text.length) return;
  el.textContent = text.slice(0, i);
  setTimeout(() => typeWriter(text, el, i + 1), 55);
}

/* ---------- CTFtime 랭킹 → 통계 카드 (ranking.json) ---------- */
// ranking.json 은 GitHub Actions(.github/workflows/update-ctftime.yml)가 매일 CTFtime 에서 받아 갱신합니다.
function loadRanking() {
  fetch("ranking.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then(renderRanking)
    .catch(() => {});
}

function renderRanking(r) {
  const card = (value, label) =>
    `<a class="stat" href="${esc(r.url)}" target="_blank" rel="noopener" title="CTFtime ${esc(r.year)} · updated ${esc(r.updated)} · ${esc(r.points)} pts">` +
    `<b>#${esc(value)}</b><span>${esc(label)}</span></a>`;
  $("stats").insertAdjacentHTML(
    "beforeend",
    card(r.global, "Global Rank (CTFtime)") + card(r.country, `${r.countryName} Rank (CTFtime)`)
  );
}
