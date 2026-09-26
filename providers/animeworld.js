// ================================================================
// AniWorld Provider for Nuvio
// Domain: aniworld.to (German & English)
// ================================================================

var TMDB_KEY = "d80ba92bc7cefe3359668d30d06f3305";
var BASE     = "https://aniworld.to";
var UA       = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function httpGet(url, extraHeaders) {
  var headers = Object.assign({ "User-Agent": UA }, extraHeaders || {});
  return fetch(url, { headers: headers }).then(function (r) {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.text();
  });
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function searchSite(title) {
  var slug = slugify(title);
  var url = BASE + "/anime/stream/" + slug;
  
  return httpGet(url, { Referer: BASE + "/" })
    .then(function (html) {
      if (html && (html.indexOf("hosterSiteVideo") !== -1 || html.indexOf("staffeln") !== -1)) {
        return url;
      }
      return null;
    })
    .catch(function () {
      return null;
    });
}

function getEpisodeUrl(seriesUrl, season, episode) {
  var epUrl = seriesUrl + "/staffel-" + (season || 1) + "/episode-" + (episode || 1);
  return httpGet(epUrl, { Referer: seriesUrl })
    .then(function (html) {
      return { url: epUrl, html: html };
    })
    .catch(function () {
      return null;
    });
}

function extractStreamsFromHtml(html, pageUrl) {
  var streams = [];
  // Liest alle Hoster-Einträge auf der AniWorld-Episodenseite aus
  var re = /<li[^>]*data-link-target="([^"]+)"[^>]*>[\s\S]*?<h4[^>]*>([^<]+)<\/h4>/g;
  var m;

  while ((m = re.exec(html)) !== null) {
    var targetPath = m[1];
    var hosterName = m[2].trim();

    streams.push({
      name: "AniWorld • " + hosterName,
      title: "AniWorld (DE/EN)",
      url: BASE + targetPath,
      quality: "HD",
      headers: {
        "User-Agent": UA,
        "Referer": pageUrl
      },
      provider: "animeworld"
    });
  }

  return streams;
}

function getStreams(tmdbId, mediaType, season, episode) {
  return new Promise(function (resolve) {
    if (mediaType === "movie") {
      resolve([]);
      return;
    }

    var tmdbUrl = "https://api.themoviedb.org/3/tv/" + tmdbId + "?api_key=" + TMDB_KEY + "&language=de-DE";

    fetch(tmdbUrl)
      .then(function (r) { return r.json(); })
      .then(function (meta) {
        var title = meta.name || meta.original_name;
        if (!title) throw new Error("No title");

        return searchSite(title);
      })
      .then(function (seriesUrl) {
        if (!seriesUrl) return null;
        return getEpisodeUrl(seriesUrl, season || 1, episode || 1);
      })
      .then(function (epData) {
        if (!epData || !epData.html) {
          resolve([]);
          return;
        }

        var results = extractStreamsFromHtml(epData.html, epData.url);
        resolve(results);
      })
      .catch(function (err) {
        console.error("[AniWorld Provider Error]", err);
        resolve([]);
      });
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
