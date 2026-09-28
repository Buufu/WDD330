(() => {
  const storage = window.FinderStorage;
  const api = window.FinderAPI;
  const previewTitles = window.FinderData.titles;
  const genres = window.FinderData.genres;
  const state = {
    allTitles: previewTitles,
    genre: "All",
    query: "",
    type: "all",
    year: "",
    rating: 0,
    page: 1,
    currentDetail: null,
    searchSequence: 0,
    toastTimer: null
  };

  const elements = {
    grid: document.getElementById("media-grid"),
    genreFilters: document.getElementById("genre-filters"),
    search: document.getElementById("search-input"),
    type: document.getElementById("type-filter"),
    year: document.getElementById("year-filter"),
    rating: document.getElementById("rating-filter"),
    region: document.getElementById("region-select"),
    status: document.getElementById("status-message"),
    empty: document.getElementById("empty-state"),
    loadMore: document.getElementById("load-more"),
    detailDialog: document.getElementById("detail-dialog"),
    detailContent: document.getElementById("detail-content"),
    settingsDialog: document.getElementById("settings-dialog"),
    trailerDialog: document.getElementById("trailer-dialog"),
    trailerFrame: document.getElementById("trailer-frame"),
    toastRegion: document.getElementById("toast-region")
  };

  const allKnownTitles = new Map(previewTitles.map(title => [String(title.id), title]));
  const page = document.body.dataset.page;
  let renderCount = 8;
  let searchTimer;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function titleFromId(id) {
    return allKnownTitles.get(String(id))
      || storage.getWatchlist().find(item => String(item.id) === String(id));
  }

  function addToCatalog(items) {
    items.forEach(item => allKnownTitles.set(String(item.id), item));
  }

  function savedTitles() {
    return storage.getWatchlist().map(item => titleFromId(item.id) || item);
  }

  function updateWatchlistCounts() {
    const count = storage.getWatchlist().length;
    document.querySelectorAll("[data-watchlist-count]").forEach(node => {
      node.textContent = String(count);
      node.setAttribute("aria-label", `${count} saved ${count === 1 ? "title" : "titles"}`);
    });
    const total = document.getElementById("watchlist-total");
    if (total) total.textContent = `${count} ${count === 1 ? "title" : "titles"}`;
  }

  function makeGenres() {
    if (!elements.genreFilters) return;
    elements.genreFilters.replaceChildren();
    genres.forEach(genre => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `genre-chip${state.genre === genre ? " is-selected" : ""}`;
      button.textContent = genre;
      button.setAttribute("aria-pressed", String(state.genre === genre));
      button.addEventListener("click", () => {
        state.genre = genre;
        state.page = 1;
        makeGenres();
        renderGrid();
      });
      elements.genreFilters.append(button);
    });
  }

  function fillYearFilter() {
    if (!elements.year) return;
    const years = [...new Set(state.allTitles.map(item => item.year).filter(Boolean))].sort((a, b) => b - a);
    elements.year.replaceChildren(new Option("Any year", ""));
    years.forEach(year => elements.year.add(new Option(String(year), String(year))));
  }

  function filteredTitles() {
    const list = page === "watchlist" ? savedTitles() : state.allTitles;
    return list.filter(item => {
      if (state.type !== "all" && item.type !== state.type) return false;
      if (state.year && Number(item.year) !== Number(state.year)) return false;
      if (Number(item.rating) < Number(state.rating)) return false;
      if (state.genre !== "All" && !(item.genres || []).some(genre => genre.toLowerCase() === state.genre.toLowerCase())) return false;
      if (state.query && !`${item.title} ${(item.genres || []).join(" ")}`.toLowerCase().includes(state.query.toLowerCase())) return false;
      return true;
    });
  }

  function isSaved(item) {
    return storage.getWatchlist().some(saved => String(saved.id) === String(item.id));
  }

  function posterMarkup(item) {
    const title = escapeHtml(item.title);
    const poster = item.poster
      ? `<img class="poster-image" src="${escapeHtml(item.poster)}" alt="" loading="lazy" onerror="this.remove()">`
      : `<span class="poster-art-orb" aria-hidden="true"></span>`;
    return `<div class="poster-wrap" data-tone="${escapeHtml(item.tone || "violet")}">
      ${poster}
      <span class="poster-overlay" aria-hidden="true"></span>
      <span class="poster-label">${escapeHtml(item.badge || "DISCOVER")}</span>
      <span class="poster-type">${item.type === "tv" ? "Series" : "Film"}</span>
      <span class="poster-title">${title}</span>
    </div>`;
  }

  function cardMarkup(item) {
    const saved = isSaved(item);
    const providerNames = (item.providers || []).slice(0, 2).map(provider => typeof provider === "string" ? provider : provider.name).join(" · ");
    const sourceNote = item.source === "preview" ? "Preview availability" : item.source === "tmdb" ? "Streaming details in title" : "";
    return `<article class="media-card" data-id="${escapeHtml(item.id)}">
      <div class="poster-wrap-host">
        <button class="poster-click" type="button" data-open-title="${escapeHtml(item.id)}" aria-label="View ${escapeHtml(item.title)} details">${posterMarkup(item)}</button>
        <button class="save-button${saved ? " is-saved" : ""}" type="button" data-toggle-save="${escapeHtml(item.id)}" aria-label="${saved ? "Remove" : "Add"} ${escapeHtml(item.title)} ${saved ? "from" : "to"} watchlist" aria-pressed="${saved}">${saved ? "♥" : "＋"}</button>
      </div>
      <button class="card-title" type="button" data-open-title="${escapeHtml(item.id)}">${escapeHtml(item.title)}</button>
      <div class="card-meta"><span>${item.year ? escapeHtml(item.year) : "Year n/a"} · ${item.type === "tv" ? "TV series" : "Movie"}</span><span class="card-rating"><span>★</span>${Number(item.rating) ? Number(item.rating).toFixed(1) : "—"}</span></div>
      ${providerNames ? `<div class="card-providers">${escapeHtml(providerNames)}${sourceNote ? ` <span class="demo-note">· ${escapeHtml(sourceNote)}</span>` : ""}</div>` : ""}
    </article>`;
  }

  function renderGrid() {
    if (!elements.grid) return;
    const filtered = filteredTitles();
    const visible = filtered.slice(0, renderCount);
    elements.grid.innerHTML = visible.map(cardMarkup).join("");
    if (elements.empty) elements.empty.hidden = filtered.length !== 0;
    if (elements.loadMore) elements.loadMore.hidden = filtered.length <= renderCount;
    const caption = document.getElementById("results-caption");
    if (caption && state.query) caption.textContent = `Search results for “${state.query}”.`;
    else if (caption && state.genre !== "All") caption.textContent = `A few ${state.genre.toLowerCase()} picks for your next night in.`;
    else if (caption && api.hasTmdbKey()) caption.textContent = `Popular movies and shows for ${regionName(storage.getRegion())}.`;
    else if (caption) caption.textContent = "The stories everyone's talking about. Preview catalog — connect TMDB for live titles.";
    updateWatchlistCounts();
  }

  function regionName(code) {
    const names = { US: "the United States", GB: "the United Kingdom", CA: "Canada", AU: "Australia", NZ: "New Zealand", DE: "Germany", FR: "France", IN: "India" };
    return names[code] || code;
  }

  function showStatus(message) {
    if (!elements.status) return;
    elements.status.textContent = message;
    elements.status.hidden = false;
  }

  function hideStatus() {
    if (elements.status) elements.status.hidden = true;
  }

  function toast(message) {
    if (!elements.toastRegion) return;
    const item = document.createElement("div");
    item.className = "toast";
    item.textContent = message;
    elements.toastRegion.append(item);
    window.setTimeout(() => item.remove(), 3600);
  }

  function toggleSave(item) {
    const list = storage.getWatchlist();
    const index = list.findIndex(saved => String(saved.id) === String(item.id));
    const isRemoving = index !== -1;
    if (isRemoving) list.splice(index, 1);
    else list.unshift(item);
    if (!storage.saveWatchlist(list)) {
      toast("Your browser couldn't save this change. Check local storage permissions.");
      return;
    }
    if (!isRemoving) allKnownTitles.set(String(item.id), item);
    renderGrid();
    if (state.currentDetail && String(state.currentDetail.id) === String(item.id)) {
      state.currentDetail = isRemoving ? item : item;
      renderDetail(state.currentDetail);
    }
    toast(isRemoving ? "Removed from your watchlist." : "Saved to your watchlist.");
  }

  function cleanText(value, fallback = "") {
    const text = String(value || fallback);
    return text.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  }

  function renderDetail(item) {
    if (!elements.detailContent) return;
    const genresText = (item.genres || []).join(" · ") || (item.type === "tv" ? "TV series" : "Movie");
    const saved = isSaved(item);
    const poster = item.poster
      ? `<img src="${escapeHtml(item.poster)}" alt="${escapeHtml(item.title)} poster" onerror="this.remove()">`
      : posterMarkup(item);
    const cast = (item.cast || []).map(person => {
      const name = Array.isArray(person) ? person[0] : person.name;
      const role = Array.isArray(person) ? person[1] : person.character;
      return `<span class="cast-chip">${escapeHtml(name)}${role ? `<span>${escapeHtml(role)}</span>` : ""}</span>`;
    }).join("");
    const providers = (item.providers || []).map(provider => {
      const name = typeof provider === "string" ? provider : provider.name;
      const url = typeof provider === "string" ? "" : provider.url;
      const logo = typeof provider === "string" ? "" : provider.logo;
      const safeUrl = validHttpsUrl(url);
      const label = `<span>${escapeHtml(name)}</span>`;
      const badgeContent = `${logo ? `<img src="${escapeHtml(logo)}" alt="" onerror="this.remove()">` : ""}${label}`;
      return safeUrl ? `<a class="provider-badge" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${badgeContent}</a>` : `<span class="provider-badge">${badgeContent}</span>`;
    }).join("");
    const disclaimer = item.source === "preview"
      ? "Preview availability only—not live listings. Add a Watchmode API key in settings for current regional options."
      : item.source === "tmdb" && !api.hasWatchmodeKey()
        ? `Availability for ${regionName(storage.getRegion())} is provided by TMDB. Connect Watchmode in settings for additional service links.`
        : item.source === "tmdb"
          ? `Showing streaming availability for ${regionName(storage.getRegion())}.`
          : `Example services only. Availability can vary in ${regionName(storage.getRegion())}.`;
    elements.detailContent.innerHTML = `
      <div class="detail-layout">
        <div class="detail-art">${poster}</div>
        <div class="detail-copy">
          <span class="detail-kicker">${escapeHtml(genresText)}</span>
          <h2 id="detail-title">${escapeHtml(item.title)}</h2>
          <div class="detail-meta"><span>${item.year ? escapeHtml(item.year) : "Year unavailable"}</span><span class="detail-rating">★ ${Number(item.rating) ? Number(item.rating).toFixed(1) : "—"}</span>${item.runtime ? `<span>${escapeHtml(item.runtime)}</span>` : ""}</div>
          <p class="detail-overview">${escapeHtml(item.overview || "No synopsis is available for this title yet.")}</p>
          ${cast ? `<h3 class="detail-section-title">Cast &amp; crew</h3><div class="cast-chips">${cast}</div>` : ""}
          <h3 class="detail-section-title">Where to watch</h3>
          <div class="provider-list">${providers || `<span class="provider-badge">No streaming services found</span>`}</div>
          <p class="provider-disclaimer">${escapeHtml(disclaimer)}</p>
          <div class="detail-actions">
            <button class="button-primary detail-watchlist" type="button" data-toggle-save="${escapeHtml(item.id)}">${saved ? "♥ Saved to watchlist" : "＋ Add to watchlist"}</button>
            <button class="trailer-button" type="button" data-play-trailer="${escapeHtml(item.trailerKey || "")}" ${item.trailerKey ? "" : "disabled"}>${item.trailerKey ? "▶ Watch trailer" : "Trailer unavailable"}</button>
          </div>
        </div>
      </div>`;
    elements.detailContent.querySelectorAll("[data-toggle-save]").forEach(button => {
      button.addEventListener("click", () => toggleSave(item));
    });
    const trailer = elements.detailContent.querySelector("[data-play-trailer]");
    if (trailer && item.trailerKey) trailer.addEventListener("click", () => playTrailer(item.trailerKey));
  }

  function validHttpsUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  async function openDetail(id) {
    const item = titleFromId(id) || storage.getWatchlist().find(saved => String(saved.id) === String(id));
    if (!item) {
      toast("Couldn't find that title. Refresh and try again.");
      return;
    }
    state.currentDetail = item;
    renderDetail(item);
    if (!elements.detailDialog.open) elements.detailDialog.showModal();
    if (item.source !== "tmdb" || !api.hasTmdbKey()) return;

    try {
      const enriched = await api.details(item, storage.getRegion());
      if (api.hasWatchmodeKey()) {
        try {
          const sources = await api.watchmode(item.title, item.type, storage.getRegion());
          if (sources.length) enriched.providers = sources;
        } catch (error) {
          console.error("Watchmode lookup failed.", error);
          toast(`Watchmode couldn't load streaming sources. ${error.message}`);
        }
      }
      enriched.source = "tmdb";
      allKnownTitles.set(String(enriched.id), enriched);
      if (state.currentDetail && String(state.currentDetail.id) === String(enriched.id) && elements.detailDialog.open) {
        state.currentDetail = enriched;
        renderDetail(enriched);
      }
      const saved = storage.getWatchlist();
      const savedIndex = saved.findIndex(entry => String(entry.id) === String(enriched.id));
      if (savedIndex !== -1) {
        saved[savedIndex] = enriched;
        storage.saveWatchlist(saved);
      }
    } catch (error) {
      console.error("TMDB title details failed.", error);
      toast(`Title details couldn't load. ${error.message}`);
    }
  }

  function playTrailer(key) {
    if (!/^[\w-]{6,20}$/.test(key)) {
      toast("This trailer link is not valid.");
      return;
    }
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(key)}?autoplay=1&rel=0`;
    iframe.title = "YouTube trailer";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.allowFullscreen = true;
    elements.trailerFrame.replaceChildren(iframe);
    elements.trailerDialog.showModal();
  }

  async function loadTrending() {
    if (!api.hasTmdbKey() || page !== "discover") return;
    showStatus("Loading current trending movies and shows…");
    try {
      const results = await api.trending(storage.getRegion());
      if (!results.length) throw new Error("No trending titles were returned.");
      state.allTitles = results.map(item => ({ ...item, source: "tmdb" }));
      addToCatalog(state.allTitles);
      fillYearFilter();
      hideStatus();
      renderGrid();
    } catch (error) {
      console.error("TMDB trending request failed.", error);
      state.allTitles = previewTitles.map(item => ({ ...item, source: "preview" }));
      addToCatalog(state.allTitles);
      fillYearFilter();
      showStatus(`Live titles couldn't load. ${error.message} Showing the preview catalog instead.`);
      renderGrid();
    }
  }

  async function searchTitles(query, sequence) {
    if (!query || !api.hasTmdbKey()) {
      state.allTitles = api.hasTmdbKey() ? state.allTitles : previewTitles.map(item => ({ ...item, source: "preview" }));
      renderGrid();
      return;
    }
    showStatus("Searching movies and shows…");
    try {
      const results = await api.search(query, storage.getRegion());
      if (sequence !== state.searchSequence) return;
      state.allTitles = results.map(item => ({ ...item, source: "tmdb" }));
      addToCatalog(state.allTitles);
      fillYearFilter();
      hideStatus();
      renderGrid();
      if (!results.length) toast("No titles found. Try a different search.");
    } catch (error) {
      if (sequence !== state.searchSequence) return;
      console.error("TMDB search failed.", error);
      hideStatus();
      toast(`Search couldn't load. ${error.message}`);
    }
  }

  function resetFilters() {
    const hadQuery = Boolean(state.query);
    state.genre = "All";
    state.query = "";
    state.type = "all";
    state.year = "";
    state.rating = 0;
    state.page = 1;
    renderCount = 8;
    if (elements.search) elements.search.value = "";
    if (elements.type) elements.type.value = "all";
    if (elements.year) elements.year.value = "";
    if (elements.rating) elements.rating.value = "0";
    makeGenres();
    renderGrid();
    if (hadQuery && api.hasTmdbKey() && page === "discover") loadTrending();
  }

  function chooseSurprise() {
    const candidates = filteredTitles();
    if (!candidates.length) {
      toast("No titles match those filters. Clear a filter and try again.");
      return;
    }
    openDetail(candidates[Math.floor(Math.random() * candidates.length)].id);
  }

  function openSettings() {
    const form = document.getElementById("settings-form");
    const keys = storage.getSettings();
    if (form) {
      form.elements.tmdb.value = keys.tmdb || "";
      form.elements.watchmode.value = keys.watchmode || "";
    }
    elements.settingsDialog.showModal();
  }

  function setupEvents() {
    document.querySelectorAll("[data-open-settings]").forEach(button => button.addEventListener("click", openSettings));
    document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));
    document.querySelectorAll("dialog").forEach(dialog => {
      dialog.addEventListener("click", event => {
        if (event.target === dialog) dialog.close();
      });
    });
    if (elements.trailerDialog) elements.trailerDialog.addEventListener("close", () => elements.trailerFrame.replaceChildren());

    if (elements.search) {
      elements.search.addEventListener("input", () => {
        window.clearTimeout(searchTimer);
        state.query = elements.search.value.trim();
        state.page = 1;
        renderCount = 8;
        const sequence = ++state.searchSequence;
        if (!api.hasTmdbKey()) {
          renderGrid();
          return;
        }
        searchTimer = window.setTimeout(() => {
          if (state.query.length >= 2) searchTitles(state.query, sequence);
          else if (!state.query) loadTrending();
        }, 360);
      });
      document.addEventListener("keydown", event => {
        if (event.key === "/" && document.activeElement !== elements.search && !event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          elements.search.focus();
        }
      });
    }

    if (elements.type) elements.type.addEventListener("change", () => { state.type = elements.type.value; renderGrid(); });
    if (elements.year) elements.year.addEventListener("change", () => { state.year = elements.year.value; renderGrid(); });
    if (elements.rating) elements.rating.addEventListener("change", () => { state.rating = Number(elements.rating.value); renderGrid(); });
    if (elements.region) {
      elements.region.value = storage.getRegion();
      elements.region.addEventListener("change", () => {
        storage.saveRegion(elements.region.value);
        toast(`Streaming region set to ${regionName(elements.region.value)}.`);
        if (api.hasTmdbKey() && page === "discover" && !state.query) loadTrending();
      });
    }
    document.querySelectorAll("[data-surprise]").forEach(button => button.addEventListener("click", chooseSurprise));
    document.querySelectorAll("[data-clear-filters]").forEach(button => button.addEventListener("click", resetFilters));

    if (elements.loadMore) elements.loadMore.addEventListener("click", () => {
      renderCount += 8;
      renderGrid();
    });

    if (elements.grid) {
      elements.grid.addEventListener("click", event => {
        const save = event.target.closest("[data-toggle-save]");
        if (save) {
          event.stopPropagation();
          const item = titleFromId(save.dataset.toggleSave);
          if (item) toggleSave(item);
          return;
        }
        const detail = event.target.closest("[data-open-title]");
        if (detail) openDetail(detail.dataset.openTitle);
      });
    }

    const settingsForm = document.getElementById("settings-form");
    if (settingsForm) settingsForm.addEventListener("submit", event => {
      event.preventDefault();
      const tmdb = settingsForm.elements.tmdb.value.trim();
      const watchmode = settingsForm.elements.watchmode.value.trim();
      if (!tmdb && !watchmode) {
        toast("Enter at least one API key, or choose preview data.");
        return;
      }
      if (!storage.saveSettings({ tmdb, watchmode })) {
        toast("The keys couldn't be saved. Check your browser storage permissions.");
        return;
      }
      elements.settingsDialog.close();
      toast("API settings saved in this browser.");
      if (tmdb && page === "discover") loadTrending();
      if (tmdb) window.FinderAPI.genres().then(map => { window.FinderData.genreMap = map; }).catch(error => console.error("TMDB genres could not load.", error));
    });

    document.querySelectorAll("[data-clear-keys]").forEach(button => button.addEventListener("click", () => {
      if (!storage.clearSettings()) {
        toast("API settings couldn't be cleared.");
        return;
      }
      const form = document.getElementById("settings-form");
      if (form) form.reset();
      elements.settingsDialog.close();
      toast("Switched to the preview catalog.");
      if (page === "discover") {
        state.allTitles = previewTitles.map(item => ({ ...item, source: "preview" }));
        addToCatalog(state.allTitles);
        renderGrid();
      }
    }));
  }

  function initialize() {
    const settings = storage.getSettings();
    if (settings.tmdb) previewTitles.forEach(item => { item.source = "preview"; });
    state.allTitles = previewTitles.map(item => ({ ...item, source: "preview" }));
    addToCatalog(state.allTitles);
    updateWatchlistCounts();
    makeGenres();
    fillYearFilter();
    setupEvents();
    if (page === "watchlist") {
      renderGrid();
    } else {
      renderGrid();
      loadTrending();
      if (settings.tmdb) {
        api.genres().then(map => { window.FinderData.genreMap = map; }).catch(error => console.error("TMDB genres could not load.", error));
      }
    }
  }

  initialize();
})();
