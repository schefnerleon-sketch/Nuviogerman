// ================================================================
// AniWorld Scraper — Prepared for Nuvio
// Domain: aniworld.to (German / English Subs & Dubs)
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
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function searchAniWorld(title) {
  var slug = slugify(title);
  var animeUrl = BASE + "/anime/stream/" + slug;

  return httpGet(animeUrl, { Referer: BASE + "/" })
    .then(function (html) {
      if (html && html.indexOf("hosterSiteVideo") !== -1) {
        return animeUrl;
      }
      return null;
    })
    .catch(function () {
      return null;
    });
}

function getEpisodePageUrl(animeUrl, season, episode) {
  var epUrl = animeUrl + "/staffel-" + season + "/episode-" + episode;

  return httpGet(epUrl, { Referer: animeUrl })
    .then(function (html) {
      return { url: epUrl, html: html };
    })
    .catch(function () {
      return null;
    });
}

function extractHosterLinks(html) {
  var hosters = [];
  var re = /data-link-target="([^"]+)"[\s\S]*?<h4[^>]*>([^<]+)<\/h4>/g;
  var m;

  while ((m = re.exec(html)) !== null) {
    var targetPath = m[1];
    var hosterName = m[2].trim();

    hosters.push({
      name: hosterName,
      url: BASE + targetPath
    });
  }

  return hosters;
}

function getStreams(tmdbId, mediaType, season, episode) {
  return new Promise(function (resolve) {
    if (mediaType === "movie") {
      // AniWorld verarbeitet primär Serien (TV)
      resolve([]);
      return;
    }

    var tmdbUrl = "https://api.themoviedb.org/3/tv/" + tmdbId + "?api_key=" + TMDB_KEY;

    fetch(tmdbUrl)
      .then(function (r) { return r.json(); })
      .then(function (meta) {
        var title = meta.name || meta.original_name;
        if (!title) throw new Error("Kein Titel von TMDB empfangen");

        return searchAniWorld(title);
      })
      .then(function (animeUrl) {
        if (!animeUrl) return null;

        return getEpisodePageUrl(animeUrl, season || 1, episode || 1);
      })
      .then(function (epData) {
        if (!epData || !epData.html) return [];

        var hosters = extractHosterLinks(epData.html);
        var streams = hosters.map(function (hoster) {
          return {
            name: "AniWorld • " + hoster.name,
            title: "AniWorld (DE/EN)",
            url: hoster.url,
            quality: "HD",
            headers: {
              "User-Agent": UA,
              "Referer": epData.url
            },
            provider: "aniworld"
          };
        });

        return streams;
      })
      .then(function (streams) {
        resolve(streams || []);
      })
      .catch(function (err) {
        console.error("[AniWorld Scraper]", err && err.message ? err.message : err);
        resolve([]);
      });
  });
}

// Export für Nuvio
if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
