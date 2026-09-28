window.FinderAPI = (() => {
  const TMDB_BASE = "https://api.themoviedb.org/3";
  const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
  const settings = () => window.FinderStorage.getSettings();

  async function request(url) {
    const response = await fetch(url);
    if (!response.ok) {
      const detail = response.status === 401 ? "Check that your API key is valid." : `The service responded with ${response.status}.`;
      throw new Error(detail);
    }
    return response.json();
  }

  function tmdbUrl(path, params = {}) {
    const key = settings().tmdb;
    const query = new URLSearchParams({ api_key: key, language: "en-US", ...params });
    return `${TMDB_BASE}${path}?${query}`;
  }

  function mapTitle(item, type) {
    const title = item.title || item.name || "Untitled";
    const date = item.release_date || item.first_air_date || "";
    return {
      id: `${type}-${item.id}`,
      tmdbId: item.id,
      title,
      year: date ? Number(date.slice(0, 4)) : null,
      type,
      rating: Number(item.vote_average) || 0,
      genres: (item.genre_ids || []).map(id => window.FinderData.genreMap[id]).filter(Boolean),
      runtime: "",
      overview: item.overview || "No synopsis is available for this title yet.",
      cast: [],
      providers: [],
      tone: "violet",
      badge: "TMDB",
      poster: item.poster_path ? `${IMAGE_BASE}${item.poster_path}` : "",
      backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : "",
      trailerKey: "",
      watchmodeId: null,
      source: "tmdb"
    };
  }

  async function trending(region) {
    const json = await request(tmdbUrl("/trending/all/week", { region }));
    return (json.results || [])
      .filter(item => item.media_type === "movie" || item.media_type === "tv")
      .map(item => mapTitle(item, item.media_type));
  }

  async function search(query, region) {
    const json = await request(tmdbUrl("/search/multi", { query, include_adult: "false", region }));
    return (json.results || [])
      .filter(item => item.media_type === "movie" || item.media_type === "tv")
      .map(item => mapTitle(item, item.media_type));
  }

  async function genres() {
    const [movie, tv] = await Promise.all([
      request(tmdbUrl("/genre/movie/list")),
      request(tmdbUrl("/genre/tv/list"))
    ]);
    return [...(movie.genres || []), ...(tv.genres || [])]
      .reduce((map, genre) => {
        map[genre.id] = genre.name;
        return map;
      }, {});
  }

  async function details(item, region) {
    const endpoint = item.type === "movie" ? `/movie/${item.tmdbId}` : `/tv/${item.tmdbId}`;
    const [detail, videos, credits, providers] = await Promise.all([
      request(tmdbUrl(endpoint)),
      request(tmdbUrl(`${endpoint}/videos`)),
      request(tmdbUrl(`${endpoint}/credits`)),
      request(tmdbUrl(`${endpoint}/watch/providers`)).catch(() => null)
    ]);
    const video = (videos.results || []).find(entry => entry.site === "YouTube" && entry.type === "Trailer")
      || (videos.results || []).find(entry => entry.site === "YouTube" && entry.type === "Teaser");
    const regional = providers && providers.results ? providers.results[region] : null;
    const providerItems = regional
      ? [...(regional.flatrate || []), ...(regional.free || []), ...(regional.ads || []), ...(regional.rent || []), ...(regional.buy || [])]
      : [];
    const uniqueProviders = [...new Map(providerItems.map(provider => [provider.provider_id, provider])).values()];
    const director = (credits.crew || []).find(person => person.job === "Director");
    const creators = (detail.created_by || []).map(person => [person.name, "Creator"]);
    const crew = director ? [[director.name, "Director"]] : creators;
    return {
      ...item,
      overview: detail.overview || item.overview,
      runtime: item.type === "movie"
        ? (detail.runtime ? `${Math.floor(detail.runtime / 60)}h ${detail.runtime % 60}m` : "")
        : (detail.number_of_seasons ? `${detail.number_of_seasons} season${detail.number_of_seasons === 1 ? "" : "s"}` : ""),
      genres: (detail.genres || []).map(genre => genre.name),
      cast: [...(credits.cast || []).slice(0, 4).map(person => [person.name, person.character || "Cast"]), ...crew],
      trailerKey: video ? video.key : "",
      providers: uniqueProviders.map(provider => ({
        name: provider.provider_name,
        url: regional.link || "",
        logo: provider.logo_path ? `https://image.tmdb.org/t/p/w92${provider.logo_path}` : ""
      })),
      backdrop: detail.backdrop_path ? `https://image.tmdb.org/t/p/w780${detail.backdrop_path}` : item.backdrop
    };
  }

  async function watchmode(title, type, region) {
    const key = settings().watchmode;
    if (!key) return [];
    const searchUrl = new URL("https://api.watchmode.com/v1/search/");
    searchUrl.search = new URLSearchParams({
      apiKey: key,
      search_field: "name",
      search_value: title,
      types: type === "movie" ? "movie" : "tv_series"
    }).toString();
    const results = await request(searchUrl.toString());
    const result = (Array.isArray(results) ? results : (results.title_results || []))[0];
    if (!result || !result.id) return [];
    const sourceUrl = new URL(`https://api.watchmode.com/v1/title/${result.id}/sources/`);
    sourceUrl.search = new URLSearchParams({ apiKey: key, regions: region }).toString();
    const sources = await request(sourceUrl.toString());
    return (sources || []).map(source => ({
      name: source.name || source.source_name || "Streaming service",
      url: source.web_url || "",
      type: source.type || ""
    }));
  }

  return { trending, search, genres, details, watchmode, hasTmdbKey: () => Boolean(settings().tmdb), hasWatchmodeKey: () => Boolean(settings().watchmode) };
})();
