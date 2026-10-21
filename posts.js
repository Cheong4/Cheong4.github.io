/* blog.html / news.html / post.html 공용 스크립트 (data-page 값으로 동작 결정) */
const $ = (s) => document.querySelector(s);
const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- 아주 작은 마크다운 렌더러 (모든 입력은 이스케이프 후 변환) ---------- */
const isSafeUrl = (u) => {
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(u.trim());
  return !m || /^(https?|mailto)$/i.test(m[1]);
};

function inline(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return "\u0000" + (codes.length - 1) + "\u0000";
  });
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, a, u) =>
    isSafeUrl(u) ? `<img src="${u}" alt="${a}" loading="lazy">` : a
  );
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) =>
    isSafeUrl(u) ? `<a href="${u}" target="_blank" rel="noopener">${t}</a>` : t
  );
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[Number(i)])}</code>`);
  return s;
}

function md(src) {
  const lines = String(src).replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  const blank = (l) => !l.trim();
  const special = /^(```|#{1,4}\s|>\s?|\s*[-*+]\s+|\s*\d+\.\s+)/;
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (blank(l)) { i++; continue; }
    let m;
    if ((m = /^```\s*([\w+-]*)\s*$/.exec(l))) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code${m[1] ? ` class="lang-${esc(m[1])}"` : ""}>${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }
    if ((m = /^(#{1,4})\s+(.*)$/.exec(l))) {
      const n = m[1].length + 1;
      out.push(`<h${n}>${inline(m[2])}</h${n}>`);
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(l)) { out.push("<hr>"); i++; continue; }
    if (/^>\s?/.test(l)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${md(buf.join("\n"))}</blockquote>`);
      continue;
    }
    const ordered = /^\s*\d+\.\s+/.test(l);
    if (ordered || /^\s*[-*+]\s+/.test(l)) {
      const re = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
      const items = [];
      while (i < lines.length && re.test(lines[i])) items.push(re.exec(lines[i++])[1]);
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</${tag}>`);
      continue;
    }
    if (l.includes("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const cells = (r) => r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      const head = cells(l);
      i += 2;
      const rows = [];
      while (i < lines.length && !blank(lines[i]) && lines[i].includes("|")) rows.push(cells(lines[i++]));
      out.push(
        `<div class="tbl"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>` +
          rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("") +
          `</tbody></table></div>`
      );
      continue;
    }
    const buf = [];
    while (i < lines.length && !blank(lines[i]) && !special.test(lines[i])) buf.push(lines[i++]);
    if (!buf.length) buf.push(lines[i++]);
    out.push(`<p>${inline(buf.join("\n")).replace(/\n/g, "<br>")}</p>`);
  }
  return out.join("\n");
}

/* ---------- front matter ---------- */
function parseFM(text) {
  text = String(text).replace(/\r\n?/g, "\n").replace(/^﻿/, "");
  const m = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(text);
  const meta = {};
  if (!m) return { meta, body: text };
  m[1].split("\n").forEach((line) => {
    const k = line.indexOf(":");
    if (k > 0 && !line.startsWith("#")) meta[line.slice(0, k).trim().toLowerCase()] = line.slice(k + 1).trim().replace(/^["']|["']$/g, "");
  });
  return { meta, body: m[2].trim() };
}
const tagList = (v) => (v ? v.split(/[,，]/).map((t) => t.trim()).filter(Boolean) : []);
const tagsHTML = (tags) => (tags && tags.length ? `<div class="ptags">${tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : "");

/* ---------- 목록 (blog / news) ---------- */
const blogItem = (i) =>
  `<li class="pitem"><div class="pmeta">${esc(i.date)}${i.author ? " · " + esc(i.author) : ""}</div>` +
  `<h2><a href="post.html?p=${encodeURIComponent(i.slug)}">${esc(i.title)}</a></h2>` +
  `<p class="psum">${esc(i.summary || "")}</p>${tagsHTML(i.tags)}</li>`;

const newsItem = (i) => {
  const link = i.url && /^https?:\/\//i.test(i.url) ? i.url : "";
  const title = link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(i.title)} ↗</a>` : esc(i.title);
  return (
    `<li class="pitem"><div class="pmeta">${esc(i.date)}${i.source ? " · " + esc(i.source) : ""}</div>` +
    `<h2>${title}</h2><div class="prose psum">${md(i.body || i.summary || "")}</div>${tagsHTML(i.tags)}</li>`
  );
};

async function initList(dir, render) {
  const box = $("#list");
  let items = [];
  try {
    const r = await fetch(`${dir}/index.json`, { cache: "no-cache" });
    if (r.ok) items = await r.json();
  } catch (e) {}
  if (!items.length) {
    box.innerHTML = `<li class="none">아직 등록된 글이 없습니다.</li>`;
    return;
  }
  const tags = [...new Set(items.flatMap((i) => i.tags || []))];
  const bar = $("#filters");
  bar.innerHTML =
    [`<button type="button" class="tab" data-tag="">전체<span class="n">${items.length}</span></button>`]
      .concat(
        tags.map(
          (t) =>
            `<button type="button" class="tab" data-tag="${esc(t)}">${esc(t)}<span class="n">${items.filter((i) => (i.tags || []).includes(t)).length}</span></button>`
        )
      )
      .join("");
  let cur = "";
  const draw = () => {
    const list = cur ? items.filter((i) => (i.tags || []).includes(cur)) : items;
    box.innerHTML = list.map(render).join("");
    bar.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tag === cur)));
  };
  bar.addEventListener("click", (e) => {
    const b = e.target.closest(".tab");
    if (b) { cur = b.dataset.tag; draw(); }
  });
  draw();
}

/* ---------- 글 상세 ---------- */
async function initPost() {
  const box = $("#post");
  const notFound = `<p class="none">글을 찾을 수 없습니다. <a href="blog.html">블로그 목록으로</a></p>`;
  const slug = new URLSearchParams(location.search).get("p") || "";
  if (!/^[\w.-]+$/.test(slug)) { box.innerHTML = notFound; return; }
  let text;
  try {
    const r = await fetch(`posts/${slug}.md`, { cache: "no-cache" });
    if (!r.ok) throw new Error();
    text = await r.text();
  } catch (e) { box.innerHTML = notFound; return; }
  const { meta, body } = parseFM(text);
  const title = meta.title || slug;
  document.title = `${title} · CheongA`;
  box.innerHTML =
    `<p class="pmeta">${esc(meta.date || "")}${meta.author ? " · " + esc(meta.author) : ""}</p>` +
    `<h1>${esc(title)}</h1>${tagsHTML(tagList(meta.tags))}` +
    `<article class="prose">${md(body)}</article>` +
    `<p class="back"><a href="blog.html">← ./blog</a></p>`;
}

const PAGE = document.body.dataset.page;
if (PAGE === "blog") initList("posts", blogItem);
else if (PAGE === "news") initList("news", newsItem);
else if (PAGE === "post") initPost();
