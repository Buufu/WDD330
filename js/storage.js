window.FinderStorage = (() => {
  const WATCHLIST_KEY = "moviefinder.watchlist.v1";
  const SETTINGS_KEY = "moviefinder.settings.v1";
  const REGION_KEY = "moviefinder.region.v1";

  function read(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      console.error(`Could not read ${key} from local storage.`, error);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Could not save ${key} to local storage.`, error);
      return false;
    }
  }

  return {
    getWatchlist() {
      const value = read(WATCHLIST_KEY, []);
      return Array.isArray(value) ? value : [];
    },
    saveWatchlist(items) {
      return write(WATCHLIST_KEY, items);
    },
    getSettings() {
      const value = read(SETTINGS_KEY, {});
      return value && typeof value === "object" ? value : {};
    },
    saveSettings(settings) {
      return write(SETTINGS_KEY, settings);
    },
    clearSettings() {
      try {
        localStorage.removeItem(SETTINGS_KEY);
        return true;
      } catch (error) {
        console.error("Could not clear API settings from local storage.", error);
        return false;
      }
    },
    getRegion() {
      try {
        return localStorage.getItem(REGION_KEY) || "US";
      } catch (error) {
        console.error("Could not read the region from local storage.", error);
        return "US";
      }
    },
    saveRegion(region) {
      try {
        localStorage.setItem(REGION_KEY, region);
        return true;
      } catch (error) {
        console.error("Could not save the region to local storage.", error);
        return false;
      }
    }
  };
})();
