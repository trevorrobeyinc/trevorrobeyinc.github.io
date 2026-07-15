/* TR-Portfolio — main.js
   No dependencies. Progressive enhancement: the page is fully usable without JS. */
(function () {
  "use strict";

  var doc = document;

  /* ----------------------------------------------------------------- year */
  var yearEl = doc.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* --------------------------------------------------------------- theme */
  var root = doc.documentElement;
  var toggle = doc.getElementById("theme-toggle");
  var iconEl = toggle ? toggle.querySelector(".theme-toggle__icon") : null;

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function effectiveTheme() {
    var forced = root.getAttribute("data-theme");
    if (forced === "dark" || forced === "light") return forced;
    return systemPrefersDark() ? "dark" : "light";
  }
  function paintIcon() {
    if (iconEl) iconEl.textContent = effectiveTheme() === "dark" ? "☾" : "☀"; // ☾ / ☀
  }
  try {
    var saved = localStorage.getItem("tr-theme");
    if (saved === "dark" || saved === "light") root.setAttribute("data-theme", saved);
  } catch (e) { /* storage blocked — fall back to system */ }
  paintIcon();

  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = effectiveTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("tr-theme", next); } catch (e) {}
      paintIcon();
    });
  }
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    (mq.addEventListener ? mq.addEventListener.bind(mq, "change") : mq.addListener.bind(mq))(paintIcon);
  }

  /* ---------------------------------------------------------- mobile nav */
  var burger = doc.getElementById("nav-burger");
  var links = doc.getElementById("nav-links");
  function closeNav() {
    if (!links) return;
    links.classList.remove("is-open");
    if (burger) { burger.setAttribute("aria-expanded", "false"); burger.setAttribute("aria-label", "Open menu"); }
  }
  if (burger && links) {
    burger.addEventListener("click", function () {
      var open = links.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    links.addEventListener("click", function (e) { if (e.target.closest("a")) closeNav(); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape") closeNav(); });
  }

  /* ---------------------------------------------------- active-link spy */
  var navAnchors = links ? Array.prototype.slice.call(links.querySelectorAll("a")) : [];
  var sections = navAnchors
    .map(function (a) { var id = a.getAttribute("href").slice(1); return doc.getElementById(id); })
    .filter(Boolean);
  if ("IntersectionObserver" in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var id = en.target.id;
        navAnchors.forEach(function (a) {
          a.classList.toggle("is-active", a.getAttribute("href") === "#" + id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* -------------------------------------------------------- reveal-on-scroll */
  var reveals = Array.prototype.slice.call(doc.querySelectorAll(".reveal"));
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); obs.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ------------------------------------------------- render project cards */
  var grid = doc.getElementById("projects-grid");
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function renderProjects(list) {
    if (!grid || !Array.isArray(list) || !list.length) return;
    grid.innerHTML = list.map(function (p) {
      var tags = (p.tags || []).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");
      var highs = (p.highlights || []).map(function (h) { return "<li>" + esc(h) + "</li>"; }).join("");
      var linksHtml = (p.links || []).map(function (l) {
        return '<a href="' + esc(l.href) + '" target="_blank" rel="noopener">' + esc(l.label) + " →</a>";
      }).join("");
      return (
        '<article class="project reveal">' +
          (p.eyebrow ? '<p class="project__eyebrow">' + esc(p.eyebrow) + "</p>" : "") +
          '<h3 class="project__title">' + esc(p.title) + "</h3>" +
          (p.subtitle ? '<p class="project__subtitle">' + esc(p.subtitle) + "</p>" : "") +
          '<p class="project__desc">' + esc(p.description) + "</p>" +
          (highs ? '<ul class="project__highlights">' + highs + "</ul>" : "") +
          (tags ? '<ul class="project__tags">' + tags + "</ul>" : "") +
          (linksHtml ? '<div class="project__links">' + linksHtml + "</div>" : "") +
        "</article>"
      );
    }).join("");
    // re-arm reveal on the freshly injected cards
    Array.prototype.slice.call(grid.querySelectorAll(".reveal")).forEach(function (el) {
      el.classList.add("is-in");
    });
  }

  // Data source: an inline <script type="application/json"> block in index.html.
  // (Inline, not fetch(), so it also works when the page is opened via file://.)
  // To add a project later, add an object to that JSON array — no other changes.
  try {
    var dataEl = doc.getElementById("projects-data");
    if (dataEl) {
      var parsed = JSON.parse(dataEl.textContent);
      renderProjects(parsed.projects || parsed);
    }
  } catch (e) { /* leave the static fallback card in the HTML */ }
})();
