/*
 * KeyFrame Staff List — in-page lookup
 * =========================================================================
 * Paste into your browser's Console (F12 → Console) on keyframe-staff-list.com
 * — or better, use the bookmarklet version so you never need DevTools at all.
 *
 * Enter names, click Run. It fetches everything in the background (shown in
 * the panel's status line). Once done, a "View Results" button appears —
 * click it to open the formatted results in a new window. Tick the JSON
 * checkbox first if you also want a keyframe_results.json file downloaded.
 */

(() => {
  document.getElementById("kfl-panel")?.remove();

  // ---------- small input panel ----------
  const panel = document.createElement("div");
  panel.id = "kfl-panel";
  const initialLeft = Math.max(20, window.innerWidth - 320 - 20);
  panel.style.cssText = `
    position: fixed; top: 20px; left: ${initialLeft}px; width: 320px;
    background: #0b0d10; color: #e8e6e1; font-family: 'Inter', system-ui, sans-serif;
    font-size: 13px; border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,.5);
    z-index: 999999; overflow: hidden; border: 1px solid #262b33;
  `;
  panel.innerHTML = `
    <div id="kfl-drag-handle" style="padding:10px 14px; background:#7e4ea0; font-weight:600; display:flex; justify-content:space-between; align-items:center; cursor:move; user-select:none;">
      <span>KeyFrame Lookup</span>
      <span id="kfl-close" style="cursor:pointer; opacity:.8;">✕</span>
    </div>
    <div style="padding:12px 14px; display:flex; flex-direction:column; gap:8px;">
      <textarea id="kfl-names" placeholder="One name per line, or comma-separated...&#10;Yutaka Nakamura&#10;Norio Matsumoto"
        style="width:100%; height:70px; resize:vertical; background:#111; color:#eee; border:1px solid #262b33; border-radius:6px; padding:6px; box-sizing:border-box; font-family:inherit;"></textarea>
      <button id="kfl-run" style="background:#7e4ea0; color:#fff; border:none; border-radius:6px; padding:8px; cursor:pointer; font-weight:600;">
        Run lookup
      </button>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div id="kfl-cache-count" style="font-size:11px; color:#8a8f98;"></div>
        <span id="kfl-clear-cache" style="font-size:11px; color:#8a8f98; cursor:pointer; text-decoration:underline;">Clear cache</span>
      </div>
      <div id="kfl-log" style="font-family:monospace; font-size:11px; color:#8a8f98; max-height:90px; overflow-y:auto; line-height:1.5; white-space:pre-wrap;"></div>
      <div id="kfl-select" style="display:none; flex-direction:column; gap:6px; background:#111; border:1px solid #262b33; border-radius:6px; padding:8px; max-height:180px; overflow-y:auto;"></div>
      <div style="display:flex; gap:8px;">
        <button id="kfl-view" style="display:none; flex:1; background:#4fd1c5; color:#0b0d10; border:none; border-radius:6px; padding:8px; cursor:pointer; font-weight:600;">
          View Results
        </button>
        <button id="kfl-download" style="display:none; flex:1; background:#1c2028; color:#e8e6e1; border:1px solid #262b33; border-radius:6px; padding:8px; cursor:pointer; font-weight:600;">
          Download JSON
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  document.getElementById("kfl-close").onclick = () => panel.remove();

  // Drag-to-move
  (() => {
    const handle = document.getElementById("kfl-drag-handle");
    let dragging = false, offsetX = 0, offsetY = 0;
    handle.addEventListener("mousedown", (e) => {
      if (e.target.id === "kfl-close") return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const maxLeft = window.innerWidth - panel.offsetWidth;
      const maxTop = window.innerHeight - 40;
      panel.style.left = `${Math.min(Math.max(0, e.clientX - offsetX), maxLeft)}px`;
      panel.style.top = `${Math.min(Math.max(0, e.clientY - offsetY), maxTop)}px`;
    });
    document.addEventListener("mouseup", () => { dragging = false; });
  })();

  const log = (msg) => {
    const el = document.getElementById("kfl-log");
    el.textContent += (el.textContent ? "\n" : "") + msg;
    el.scrollTop = el.scrollHeight;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const DELAY_MS = 3000;

  // Cache of already-fetched results, keyed by normalized name. Persists
  // for as long as this panel stays open, so adding a name to the list and
  // re-running won't re-fetch names you already have. Re-opening the panel
  // (clicking the bookmarklet again) starts a fresh cache.
  const cache = {};
  const cacheKey = (name) => name.trim().toLowerCase();

  const updateCacheCount = () => {
    const n = Object.keys(cache).length;
    document.getElementById("kfl-cache-count").textContent = n > 0 ? `${n} cached` : "";
  };

  document.getElementById("kfl-clear-cache").onclick = () => {
    for (const k in cache) delete cache[k];
    updateCacheCount();
    log("Cache cleared.");
  };

  function esc(s) {
    if (s == null) return "";
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function buildRoleGroups(credits) {
    const roleMaps = {};
    for (const work of credits || []) {
      for (const nameEntry of work.names || []) {
        for (const cat of nameEntry.categories || []) {
          for (const role of cat.roles || []) {
            const roleName = role.role_en || cat.category || "Other";
            if (!roleMaps[roleName]) roleMaps[roleName] = new Map();
            const map = roleMaps[roleName];
            if (!map.has(work.uuid)) {
              map.set(work.uuid, {
                work: work.stafflist_name, workJa: work.stafflist_name_ja,
                year: work.seasonYear, slug: work.slug, studios: work.stafflist_studios,
                status: work.status, kv: work.stafflist_kv, episodes: [],
              });
            }
            const entry = map.get(work.uuid);
            for (const c of role.credits || []) {
              if (c.episode) entry.episodes.push(c.episode);
            }
          }
        }
      }
    }
    const roles = {};
    for (const [roleName, map] of Object.entries(roleMaps)) {
      roles[roleName] = Array.from(map.values()).sort((a, b) => (b.year || 0) - (a.year || 0));
    }
    return roles;
  }

  // Groups by WORK instead of by role — one card per anime, with all of this
  // person's roles on it listed together, each with its own episode list.
  // This is what feeds the AniList-style poster grid view (as opposed to the
  // role-first list view above).
  function buildWorkGrid(credits) {
    const map = new Map();
    for (const work of credits || []) {
      if (!map.has(work.uuid)) {
        map.set(work.uuid, {
          work: work.stafflist_name, workJa: work.stafflist_name_ja,
          year: work.seasonYear, slug: work.slug, studios: work.stafflist_studios,
          status: work.status, kv: work.stafflist_kv, roleMap: new Map(), // roleName -> episodes[]
        });
      }
      const entry = map.get(work.uuid);
      for (const nameEntry of work.names || []) {
        for (const cat of nameEntry.categories || []) {
          for (const role of cat.roles || []) {
            const roleName = role.role_en || cat.category || "Other";
            if (!entry.roleMap.has(roleName)) entry.roleMap.set(roleName, []);
            for (const c of role.credits || []) {
              if (c.episode) entry.roleMap.get(roleName).push(c.episode);
            }
          }
        }
      }
    }
    return Array.from(map.values())
      .map((w) => ({
        work: w.work, workJa: w.workJa, year: w.year, slug: w.slug,
        studios: w.studios, status: w.status, kv: w.kv,
        roles: Array.from(w.roleMap.entries()).map(([name, episodes]) => ({ name, episodes })),
      }))
      .sort((a, b) => (b.year || 0) - (a.year || 0));
  }

  async function searchName(name) {
    const searchRes = await fetch(`/api/search/?q=${encodeURIComponent(name)}&type=all`, { credentials: "include" });
    if (!searchRes.ok) return { error: `Search failed (status ${searchRes.status})` };
    const matches = (await searchRes.json()).staff || [];
    if (matches.length === 0) return { error: "No matching staff found" };
    return { matches };
  }

  async function fetchProfile(name, staffId, allMatches) {
    const result = { query: name, found: false, allSearchMatches: allMatches };

    const profileRes = await fetch(`/api/person/show.php?id=${staffId}&type=person`, { credentials: "include" });
    if (!profileRes.ok) { result.error = `Profile fetch failed (status ${profileRes.status})`; return result; }
    const data = await profileRes.json();
    const staff = data.staff || {};
    const credits = data.credits || [];

    result.found = true;
    result.id = staff.id;
    result.nameEn = staff.en;
    result.nameJa = staff.ja;
    result.jobs = data.jobs || [];
    result.studios = data.studios || {};
    result.creditCount = credits.length;
    result.roles = buildRoleGroups(credits);
    result.workGrid = buildWorkGrid(credits);

    return result;
  }

  // Shows candidate buttons in the panel and resolves with the chosen match
  // (or null if the user clicks Skip). Pauses the run loop until answered.
  function promptForMatch(name, matches) {
    return new Promise((resolve) => {
      const box = document.getElementById("kfl-select");
      box.style.display = "flex";
      box.innerHTML = `<div style="color:#8a8f98; font-size:11.5px; margin-bottom:2px;">Multiple matches for "${esc(name)}" — pick one:</div>`;

      matches.forEach((m, i) => {
        const btn = document.createElement("button");
        const jobsPreview = (m.jobs || []).slice(0, 2).join(", ");
        const studioTag = m.is_studio ? "[Studio] " : "";
        btn.textContent = `${studioTag}${m.en || m.ja || "Unnamed"}${m.ja ? ` (${m.ja})` : ""}${jobsPreview ? ` — ${jobsPreview}` : ""}`;
        btn.style.cssText = m.is_studio
          ? "text-align:left; background:#1c2028; color:#f5a623; border:1px solid #3a3020; border-radius:6px; padding:6px 8px; cursor:pointer; font-size:11.5px;"
          : "text-align:left; background:#1c2028; color:#e8e6e1; border:1px solid #262b33; border-radius:6px; padding:6px 8px; cursor:pointer; font-size:11.5px;";
        btn.onclick = () => { box.style.display = "none"; box.innerHTML = ""; resolve(matches[i]); };
        box.appendChild(btn);
      });

      const skipBtn = document.createElement("button");
      skipBtn.textContent = "Skip this name";
      skipBtn.style.cssText = "background:#2a1414; color:#f2a; border:1px solid #4a1f1f; border-radius:6px; padding:6px 8px; cursor:pointer; font-size:11.5px;";
      skipBtn.onclick = () => { box.style.display = "none"; box.innerHTML = ""; resolve(null); };
      box.appendChild(skipBtn);
    });
  }

  async function lookupName(name) {
    const searchResult = await searchName(name);
    if (searchResult.error) return { query: name, found: false, error: searchResult.error };

    const matches = searchResult.matches;
    const allMatches = matches.map((m) => ({ id: m.anilist_id, en: m.en, ja: m.ja, jobs: m.jobs, isStudio: !!m.is_studio }));

    let chosen;
    if (matches.length === 1) {
      chosen = matches[0];
    } else {
      log(`  -> ${matches.length} matches found, pick one in the panel...`);
      chosen = await promptForMatch(name, matches);
      if (!chosen) return { query: name, found: false, error: "Skipped by user (multiple matches)", allSearchMatches: allMatches };
    }

    if (chosen.is_studio) {
      return { query: name, found: false, error: "That match is a studio, not a staff member — studio profiles aren't supported by this tool", allSearchMatches: allMatches };
    }

    if (chosen.anilist_id == null) return { query: name, found: false, error: "Chosen match had no id", allSearchMatches: allMatches };

    return fetchProfile(name, chosen.anilist_id, allMatches);
  }

  // ---------- results page builder ----------
  let uid = 0;
  function renderPerson(r) {
    if (!r.found) {
      return `<div class="person"><div class="error-card"><span class="q">${esc(r.query)}</span> — ${esc(r.error || "not found")}</div></div>`;
    }
    const jobs = (r.jobs || []).map((j) => `<span class="badge">${esc(j)}</span>`).join("");
    const roles = r.roles || {};
    const roleNames = Object.keys(roles).sort((a, b) => roles[b].length - roles[a].length);

    const rolesHtml = roleNames.map((roleName) => {
      const works = roles[roleName];
      const sectionId = `kfl-role-${uid++}`;
      return `
        <div class="role-section" id="${sectionId}">
          <div class="role-head" onclick="document.getElementById('${sectionId}').classList.toggle('open')">
            <span class="role-arrow">▶</span>
            <span class="role-title">${esc(roleName)}</span>
            <span class="role-count">${works.length}</span>
          </div>
          <div class="role-works">
            ${works.map((w) => `
              <div class="role-work">
                ${w.kv ? `<img class="role-work-thumb" src="${esc(w.kv)}" alt="" loading="lazy" onerror="this.remove()">` : ""}
                <div class="role-work-text">
                  <div class="role-work-title">${esc(w.work || w.slug)}</div>
                  <div class="role-work-meta">
                    <span class="year">${esc(w.year ?? "—")}</span>
                    ${w.studios ? `<span>${esc(w.studios)}</span>` : ""}
                    ${w.episodes && w.episodes.length ? `<span>${esc(w.episodes.join(", "))}</span>` : ""}
                  </div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="person">
        <div class="person-head">
          <div class="person-name">${esc(r.nameEn || r.query)}${r.nameJa ? `<span class="ja">${esc(r.nameJa)}</span>` : ""}</div>
          <div class="badges">${jobs}</div>
        </div>
        <div>${rolesHtml || '<div style="padding:16px 22px; color:var(--muted); font-size:13px;">No credits listed.</div>'}</div>
      </div>
    `;
  }

  function renderPersonGrid(r) {
    if (!r.found) {
      return `<div class="person"><div class="error-card"><span class="q">${esc(r.query)}</span> — ${esc(r.error || "not found")}</div></div>`;
    }
    const jobs = (r.jobs || []).map((j) => `<span class="badge">${esc(j)}</span>`).join("");
    const works = r.workGrid || [];

    const cardsHtml = works.map((w) => `
      <div class="grid-card">
        ${w.kv
          ? `<img class="grid-card-img" src="${esc(w.kv)}" alt="" loading="lazy" onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='flex';">`
          : ""}
        <div class="grid-card-placeholder" style="${w.kv ? "display:none;" : ""}">${esc((w.work || w.slug || "?").slice(0, 1))}</div>
        <div class="grid-card-title">${esc(w.work || w.slug)}</div>
        <div class="grid-card-year">${esc(w.year ?? "—")}</div>
        <div class="grid-role-pills">${w.roles.map((r) => `<span class="grid-role-pill">${esc(r.name)}${r.episodes.length ? ` <span class="ep">${esc(r.episodes.join(", "))}</span>` : ""}</span>`).join("")}</div>
      </div>
    `).join("");

    const GRID_PREVIEW_ROWS = 2; // how many full rows to show before collapsing
    const TOGGLE_THRESHOLD = 8; // rough cutoff to decide whether a toggle is worth showing at all
    const needsToggle = works.length > TOGGLE_THRESHOLD;
    const gridId = `kfl-grid-${uid++}`;

    // Toggle link sits in the header (not below the grid) and stays sticky
    // while scrolling, so collapsing is always reachable. The exact number
    // of cards to hide is computed at runtime (see the script at the bottom
    // of buildResultsPage) since it depends on how many columns actually fit
    // the screen — that's the only way to guarantee full rows, never a
    // cropped one.
    const toggleLink = needsToggle
      ? `<span class="grid-toggle-link" id="${gridId}-btn" onclick="
          const el = document.getElementById('${gridId}');
          el.classList.toggle('expanded');
          document.getElementById('${gridId}-btn').textContent = el.classList.contains('expanded') ? 'Show less' : 'Show all ${works.length}';
          window.kflRefreshGridPreviews();
        ">Show all ${works.length}</span>`
      : "";

    return `
      <div class="person">
        <div class="person-head person-head-split">
          <div>
            <div class="person-name">${esc(r.nameEn || r.query)}${r.nameJa ? `<span class="ja">${esc(r.nameJa)}</span>` : ""}</div>
            <div class="badges">${jobs}</div>
          </div>
          ${toggleLink}
        </div>
        <div class="work-grid-wrap${needsToggle ? "" : " expanded"}" id="${gridId}" data-preview-rows="${GRID_PREVIEW_ROWS}">
          <div class="work-grid">${cardsHtml || '<div style="padding:16px 22px; color:var(--muted); font-size:13px;">No credits listed.</div>'}</div>
        </div>
      </div>
    `;
  }

  function buildResultsPage(results) {
    const doneMsg = `${results.filter((r) => r.found).length}/${results.length} found`;
    const bodyHtmlList = results.map(renderPerson).join("");
    const bodyHtmlGrid = results.map(renderPersonGrid).join("");
    return `
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>KeyFrame Lookup — Results</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
      <style>
        :root { --bg:#0b0d10; --panel:#15181d; --panel-2:#1c2028; --line:#262b33; --text:#e8e6e1; --muted:#8a8f98; --amber:#f5a623; --cyan:#4fd1c5; }
        * { box-sizing: border-box; }
        body { margin:0; background:var(--bg); color:var(--text); font-family:'Inter',sans-serif; min-height:100vh; }
        header { padding: 28px 24px 18px; border-bottom: 1px solid var(--line); display:flex; align-items:center; gap:14px; }
        .slate-mark { width:30px; height:30px; background: repeating-linear-gradient(45deg, var(--amber), var(--amber) 6px, #111 6px, #111 12px); border-radius:4px; flex-shrink:0; }
        h1 { font-family:'Space Grotesk',sans-serif; font-size:19px; font-weight:700; margin:0; }
        h1 span { color: var(--amber); }
        .sub { color:var(--muted); font-size:13px; margin-top:2px; }
        main { max-width: 900px; margin:0 auto; padding: 28px 24px 80px; }
        .person { background:var(--panel); border:1px solid var(--line); border-radius:10px; margin-bottom:20px; }
        .person-head { padding:18px 22px; border-bottom:1px solid var(--line); }
        .person-name { font-family:'Space Grotesk',sans-serif; font-size:18px; font-weight:700; }
        .person-name .ja { font-family:'Inter',sans-serif; font-weight:400; color:var(--muted); font-size:13px; margin-left:8px; }
        .badges { display:flex; flex-wrap:wrap; gap:6px; margin-top:9px; }
        .badge { font-size:11px; padding:4px 9px; border-radius:20px; background:var(--panel-2); border:1px solid var(--line); color:var(--cyan); font-family:'JetBrains Mono',monospace; }
        .role-section { border-bottom:1px solid var(--line); }
        .role-section:last-child { border-bottom:none; }
        .role-head { padding:12px 22px; display:flex; align-items:center; gap:10px; cursor:pointer; user-select:none; }
        .role-head:hover { background:var(--panel-2); }
        .role-arrow { color:var(--amber); font-size:11px; transition:transform .15s ease; width:10px; flex-shrink:0; }
        .role-section.open .role-arrow { transform: rotate(90deg); }
        .role-title { font-weight:600; font-size:14px; flex:1; }
        .role-count { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--amber); background:rgba(245,166,35,.1); padding:2px 8px; border-radius:20px; }
        .role-works { display:none; padding:0 22px 12px 46px; }
        .role-section.open .role-works { display:block; }
        .role-work { display:flex; gap:10px; align-items:flex-start; padding:8px 0; border-bottom:1px dashed var(--line); }
        .role-work:last-child { border-bottom:none; }
        .role-work-thumb { width:42px; height:58px; object-fit:cover; border-radius:4px; flex-shrink:0; background:var(--panel-2); }
        .role-work-text { flex:1; min-width:0; }
        .role-work-title { font-weight:600; font-size:14px; }
        .role-work-meta { margin-top:3px; font-family:'JetBrains Mono',monospace; font-size:11.5px; color:var(--muted); display:flex; gap:10px; flex-wrap:wrap; }
        .role-work-meta .year { color:var(--cyan); }
        .error-card { padding:16px 22px; color:var(--muted); font-size:13px; }
        .error-card .q { color:var(--text); font-weight:600; }
        footer { text-align:center; color:var(--muted); font-size:12px; padding:20px; }
        footer a { color:var(--amber); }

        /* view toggle */
        .view-toggle { display:flex; gap:6px; margin-left:auto; }
        .view-toggle button {
          font-family:'Inter',sans-serif; font-size:12.5px; font-weight:600;
          background:var(--panel-2); color:var(--muted); border:1px solid var(--line);
          border-radius:6px; padding:7px 14px; cursor:pointer;
        }
        .view-toggle button.active { background:var(--amber); color:#14171c; border-color:var(--amber); }

        /* AniList-style poster grid */
        #kfl-view-grid { display:none; }
        body[data-view="grid"] #kfl-view-list { display:none; }
        body[data-view="grid"] #kfl-view-grid { display:block; }
        .work-grid {
          display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr));
          gap:16px; padding:18px 22px;
        }
        .grid-card { display:flex; flex-direction:column; }
        .grid-card-img {
          width:100%; aspect-ratio:2/3; object-fit:cover; border-radius:6px;
          background:var(--panel-2); box-shadow:0 2px 10px rgba(0,0,0,.4);
        }
        .grid-card-placeholder {
          width:100%; aspect-ratio:2/3; border-radius:6px; background:var(--panel-2);
          display:flex; align-items:center; justify-content:center;
          font-family:'Space Grotesk',sans-serif; font-size:28px; font-weight:700; color:var(--line);
        }
        .grid-card-title {
          font-size:12.5px; font-weight:600; line-height:1.3; margin-top:7px;
          display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
        }
        .grid-card-year { font-family:'JetBrains Mono',monospace; font-size:10.5px; color:var(--cyan); margin-top:3px; }
        .grid-role-pills { display:flex; flex-wrap:wrap; gap:4px; margin-top:5px; }
        .grid-role-pill {
          font-size:9px; background:var(--panel-2); border:1px solid var(--line);
          padding:2px 6px; border-radius:20px; color:var(--muted);
        }
        .grid-role-pill .ep { color:var(--cyan); font-family:'JetBrains Mono',monospace; }

        .person-head-split {
          display:flex; justify-content:space-between; align-items:flex-start; gap:14px; flex-wrap:wrap;
          position:sticky; top:0; z-index:5; background:var(--panel); border-radius:10px 10px 0 0;
        }
        .grid-toggle-link {
          font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--amber);
          cursor:pointer; white-space:nowrap; padding-top:3px; user-select:none;
        }
        .grid-toggle-link:hover { text-decoration:underline; }

        /* Cards past the computed preview count are hidden via inline style,
           set at runtime by the script at the bottom of this page — see
           kflRefreshGridPreviews(). This guarantees whole rows only. */
      </style>
      <link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><pattern id="s" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#f5a623"/><rect width="4" height="8" fill="#111111"/></pattern></defs><rect width="32" height="32" rx="6" fill="url(#s)"/></svg>')}">
      </head>
      <body data-view="list">
        <header>
          <div class="slate-mark"></div>
          <div><h1>KEY<span>FRAME</span> RESULTS</h1><div class="sub">${esc(doneMsg)}</div></div>
          <div class="view-toggle">
            <button id="kfl-btn-list" class="active" onclick="document.body.dataset.view='list';document.getElementById('kfl-btn-list').classList.add('active');document.getElementById('kfl-btn-grid').classList.remove('active');">☰ List</button>
            <button id="kfl-btn-grid" onclick="document.body.dataset.view='grid';document.getElementById('kfl-btn-grid').classList.add('active');document.getElementById('kfl-btn-list').classList.remove('active');window.kflRefreshGridPreviews();">▦ Grid</button>
          </div>
        </header>
        <main>
          <div id="kfl-view-list">${bodyHtmlList}</div>
          <div id="kfl-view-grid">${bodyHtmlGrid}</div>
        </main>
        <footer>Data via <a href="https://keyframe-staff-list.com" target="_blank">KeyFrame Staff List</a></footer>
        <script>
          // Hides grid cards past N full rows, where N (rows-per-preview) is
          // fixed but the column count is measured live -- guarantees the
          // preview always ends on a complete row regardless of screen width.
          // Only runs meaningfully while Grid view is actually visible, since
          // hidden elements can't be measured (offsetTop is always 0).
          window.kflRefreshGridPreviews = function () {
            if (document.body.dataset.view !== "grid") return;
            document.querySelectorAll(".work-grid-wrap").forEach(function (wrap) {
              var cards = wrap.querySelectorAll(".grid-card");
              if (!cards.length) return;
              if (wrap.classList.contains("expanded")) {
                cards.forEach(function (c) { c.style.display = ""; });
                return;
              }
              var firstTop = cards[0].offsetTop;
              var columns = 0;
              for (var i = 0; i < cards.length; i++) {
                if (cards[i].offsetTop === firstTop) columns++; else break;
              }
              if (columns < 1) columns = 1;
              var rows = parseInt(wrap.dataset.previewRows || "2", 10);
              var previewCount = columns * rows;
              cards.forEach(function (c, i) { c.style.display = i < previewCount ? "" : "none"; });
            });
          };
          var kflResizeTimer;
          window.addEventListener("resize", function () {
            clearTimeout(kflResizeTimer);
            kflResizeTimer = setTimeout(window.kflRefreshGridPreviews, 150);
          });
        </script>
      </body></html>
    `;
  }

  let lastResults = null;

  document.getElementById("kfl-view").onclick = () => {
    if (!lastResults) return;
    const win = window.open("", "_blank");
    if (!win) { log("Popup blocked — allow popups for this site and try again."); return; }
    win.document.write(buildResultsPage(lastResults));
    win.document.close();
  };

  document.getElementById("kfl-download").onclick = () => {
    if (!lastResults) return;
    const blob = new Blob([JSON.stringify(lastResults, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "keyframe_results.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  document.getElementById("kfl-run").onclick = async () => {
    const names = document.getElementById("kfl-names").value
      .split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (names.length === 0) { log("Enter at least one name."); return; }

    document.getElementById("kfl-log").textContent = "";
    document.getElementById("kfl-run").disabled = true;
    document.getElementById("kfl-view").style.display = "none";
    document.getElementById("kfl-download").style.display = "none";
    lastResults = null;

    const results = [];
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const key = cacheKey(name);

      if (cache[key]) {
        log(`${name}: using cached result`);
        results.push(cache[key]);
        continue;
      }

      log(`Looking up: ${name} ...`);
      try {
        const res = await lookupName(name);
        results.push(res);
        cache[key] = res;
        updateCacheCount();
        log(res.found ? `  -> OK` : `  -> FAILED (${res.error})`);
      } catch (e) {
        const failed = { query: name, found: false, error: String(e) };
        results.push(failed);
        cache[key] = failed;
        updateCacheCount();
        log(`  -> ERROR: ${e}`);
      }
      // Only delay after an actual network fetch, not after a cache hit.
      if (i < names.length - 1) await sleep(DELAY_MS);
    }

    lastResults = results;
    log(`Done — ${results.filter((r) => r.found).length}/${results.length} found.`);
    document.getElementById("kfl-run").disabled = false;
    document.getElementById("kfl-view").style.display = "block";
    document.getElementById("kfl-download").style.display = "block";
  };

  log("Ready. Enter names above and click Run.");
})();
