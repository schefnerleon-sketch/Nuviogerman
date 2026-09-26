// ================================================================
// AniWorld Provider for Nuvio (with Direct Hoster Unshorter)
// Domain: aniworld.to (German & English)
// ================================================================

var TMDB_KEY = "d80ba92bc7cefe3359668d30d06f3305";
var BASE     = "https://aniworld.to";
var UA       = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function httpGet(url, extraHeaders) {
  var headers = Object.assign({ "User-Agent": UA }, extraHeaders || {});
  return fetch(url, { headers: headers, redirect: 'follow' }).then(function (r) {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.text();
  });
}

function slugify(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function checkAnimeUrl(slug) {
  var url = BASE + "/anime/stream/" + slug;
  return httpGet(url, { Referer: BASE + "/" })
    .then(function (html) {
      if (html && (html.indexOf("hosterSiteVideo") !== -1 || html.indexOf("staffeln") !== -1 || html.indexOf("staffel-1") !== -1)) {
        return url;
      }
      return null;
    })
    .catch(function () {
      return null;
    });
}

function searchSite(titles) {
  var promiseChain = Promise.resolve(null);

  titles.forEach(function(title) {
    promiseChain = promiseChain.then(function(foundUrl) {
      if (foundUrl) return foundUrl;
      var slug = slugify(title);
      if (!slug) return null;
      return checkAnimeUrl(slug);
    });
  });

  return promiseChain;
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

function resolveHosterRedirect(redirectUrl) {
  // Verfolgt den AniWorld-Redirect zum tatsächlichen Hoster (z. B. VOE, Vidoza, Streamtape)
  return fetch(redirectUrl, {
    method: "GET",
    headers: { "User-Agent": UA },
    redirect: "follow"
  }).then(function (res) {
    return res.url; // Liefert die finale Hoster-URL zurück
  }).catch(function () {
    return null;
  });
}

function extractHosterTargets(html) {
  var redirectPaths = [];
  var re = /<li[^>]*data-link-target="([^"]+)"[^>]*>[\s\S]*?<h4[^>]*>([^<]+)<\/h4>/g;
  var m;

  while ((m = re.exec(html)) !== null) {
    redirectPaths.push({
      target: BASE + m[1],
      name: m[2].trim()
    });
  }

  return redirectPaths;
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
        var possibleTitles = [];
        if (meta.name) possibleTitles.push(meta.name);
        if (meta.original_name) possibleTitles.push(meta.original_name);

        if (possibleTitles.length === 0) throw new Error("Kein Titel gefunden");

        return searchSite(possibleTitles);
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

        var hosters = extractHosterTargets(epData.html);
        
        // Versucht die ersten 3 Hoster-Links aufzulösen
        var promises = hosters.slice(0, 3).map(function (item) {
          return resolveHosterRedirect(item.target).then(function (finalUrl) {
            if (!finalUrl) return null;
            return {
              name: "AniWorld • " + item.name,
              title: "AniWorld (DE/EN)",
              url: finalUrl,
              quality: "HD",
              headers: {
                "User-Agent": UA,
                "Referer": epData.url
              },
              provider: "animeworld"
            };
          });
        });

        return Promise.all(promises);
      })
      .then(function (results) {
        if (!results) {
          resolve([]);
          return;
        }
        var cleanResults = results.filter(function (r) { return r !== null; });
        resolve(cleanResults);
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
