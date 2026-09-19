(() => {

// =====================================================================
// Guard against double-initialization. If the injector (or a page
// reload race) somehow runs this script twice into the same live page,
// we don't want two MutationObservers/timers stacking up. Also exposes
// a small debug handle on window so you can check from devtools
// whether the script is currently alive at all, without guessing from
// log timing:
//
//   window.__backdropSlideshow.loadedAt       -> when this instance started
//   window.__backdropSlideshow.scanForCards() -> manually trigger a scan
//   window.__backdropSlideshow.lastFound       -> last known found/not-found
//                                                 per library id
// =====================================================================

if (window.__backdropSlideshow) {
    console.log("[Backdrop] Script already active (loaded at",
        new Date(window.__backdropSlideshow.loadedAt).toLocaleTimeString(),
        ") — skipping duplicate init.");
    return;
}

// =====================================================================
// CONFIG — one entry per library card you want this effect on.
// Fill in each library's card id (the data-id attribute on the .card
// element) and the item type(s) ApiClient.getItems should fetch
// backdrops from.
// =====================================================================

console.log("[Backdrop] Script executing, initializing...");

const LIBRARIES = [
    {
        id: "f137a2dd21bbc1b99aa5c0f6bf02a805",
        title: "Movies",
        includeItemTypes: "Movie",
        imageType: "Backdrop"
    },
    {
        id: "a656b907eb3a73532e40e44b968d0225",
        title: "Shows",
        includeItemTypes: "Series",
        imageType: "Backdrop"
    },
    {
        id: "9d7ad6afe9afa2dab1a2f6e00ad28fa6",
        title: "Collections",
        includeItemTypes: "BoxSet",
        imageType: "Backdrop"
    },
    {
        id: "7e64e319657a9516ec78490da03edccb",
        title: "Music",
        includeItemTypes: null,
        imageType: "Primary"
    },
    {
        id: "4e985111ed7f570b595204d82adb02f3",
        title: "Books",
        includeItemTypes: "Book",
        // Books don't carry backdrop art — use cover art instead.
        imageType: "Primary"
    },
    {
        id: "c0c1444b416777d3fa55d5f13da1ce58",
        title: "Audiobooks",
        includeItemTypes: "AudioBook",
        // Same reasoning as Books — cover art only.
        imageType: "Primary"
    },
    {
        id: "6f6c941d77cac5227434dea56b095315",
        title: "Playlists",
        includeItemTypes: "Playlist",
        // Playlists have generated tile art, no backdrops.
        imageType: "Primary"
    }
];

const GRADIENT = "http://192.168.1.78:7869/gradient.png";

const IMAGE_WIDTH = 448;
const INTERVAL = 300;

// Cache API results per library id so we only hit the server once
// per page load, no matter how many times the card gets remounted
// (e.g. navigating Dashboard -> Home -> Dashboard -> Home ...).
const itemCache = new Map();

// =====================================================================
// Builds the preloadable Image() list for a library, using the cached
// item list if we already fetched it this session.
// =====================================================================

async function getImagesForLibrary({ id, title, includeItemTypes, imageType }) {

    if (itemCache.has(id))
        return buildImages(itemCache.get(id), imageType);

    const query = {
        ParentId: id,
        Recursive: true,
        Fields: imageType === "Backdrop"
            ? "BackdropImageTags"
            : "BackdropImageTags,PrimaryImageAspectRatio",
        Limit: 60
    };

    if (includeItemTypes)
        query.IncludeItemTypes = includeItemTypes;

    const result = await ApiClient.getItems(
        ApiClient._serverInfo.UserId,
        query
    );

    const items = result.Items.filter(x =>
        imageType === "Backdrop"
            ? (x.BackdropImageTags && x.BackdropImageTags.length)
            : (x.ImageTags && x.ImageTags[imageType])
    );

    itemCache.set(id, items);

    console.log(`[Backdrop] Fetched ${imageType} items for ${title}:`, items.length);

    return buildImages(items, imageType);
}

function buildImages(items, imageType) {
    return items
        .sort(() => Math.random() - 0.5)
        .map(x => {
            const image = new Image();

            const tagParam = imageType === "Backdrop"
                ? ""
                : `&tag=${x.ImageTags[imageType]}`;

            image.src =
                `${ApiClient._serverAddress}/Items/${x.Id}/Images/${imageType}?maxWidth=${IMAGE_WIDTH}&quality=60${tagParam}`;

            return image;
        });
}

// =====================================================================
// Per-card state (image cache, current slideshow index, timer, and the
// live overlay elements). Keyed by the <card> DOM node itself via a
// WeakMap, so it's automatically garbage collected if the card is ever
// truly removed for good, but survives across re-scans of the same
// (possibly recycled) node.
//
// IMPORTANT: Jellyfin appears to recycle/reuse card DOM nodes rather
// than always creating fresh ones when you navigate back to a view
// (likely for rendering performance). That means a node can keep any
// dataset flag we set on it while Jellyfin silently wipes and
// repopulates its children out from under us — so a flag alone isn't a
// reliable way to know whether our overlay is still actually there.
// Instead, every scan physically checks whether our overlay elements
// are still attached, and only recreates them if they're missing.
// =====================================================================

const cardState = new WeakMap();

function nextFrame(state) {
    if (!state.cache || !state.cache.length) return;

    let attempts = 0;
    while (!state.cache[state.index].complete && attempts < state.cache.length) {
        state.index++;
        if (state.index >= state.cache.length) state.index = 0;
        attempts++;
    }

    state.img.src = state.cache[state.index].src;

    state.index++;
    if (state.index >= state.cache.length) state.index = 0;
}

// =====================================================================
// Ensures a single library card has both its visual overlay (image +
// title) and its hover listeners. Safe to call repeatedly/often:
// - Overlay: recreated only if missing from the DOM right now.
// - Listeners: attached only once ever per card node (tracked in state).
// =====================================================================

async function ensureLibraryCard(card, libConfig) {

    const scalable = card.querySelector(".cardScalable");
    if (!scalable) return;

    let state = cardState.get(card);
    if (!state) {
        state = {
            cache: null,
            index: 0,
            timer: null,
            img: null,
            titleEl: null,
            listenersAttached: false
        };
        cardState.set(card, state);
    }

    const overlayMissing = !state.img || !scalable.contains(state.img);

    if (overlayMissing) {

        scalable.style.position = "relative";
        scalable.style.overflow = "hidden";

        // IMPORTANT: containerType goes on `card` (the actual grid item,
        // whose size comes directly from the row's grid/flex layout),
        // not on `scalable`. Setting container-type also applies CSS
        // containment, which tells the browser this element's size can
        // be computed independently of its content — fine for `card`,
        // but if applied to `scalable` (whose width may be derived
        // indirectly through it) it can occasionally get "stuck" at
        // 0x0 right when a recycled card gets repopulated, collapsing
        // our inset:0 overlay along with it even though every one of
        // its own CSS properties looks correct.
        card.style.containerType = "inline-size";

        // =====================
        // BACKGROUND IMAGE
        // =====================

        const img = document.createElement("img");
        img.className = "custom-backdrop-bg";

        Object.assign(img.style, {
            position: "absolute",
            inset: "0",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: "1",
            transition: "opacity .3s ease",
            pointerEvents: "none"
        });

        // Idle gradient disabled — see notes below to restore it.
        // img.src = GRADIENT;
        img.style.opacity = "0";

        // =====================
        // TITLE
        // =====================

        const titleEl = document.createElement("div");
        titleEl.className = "custom-backdrop-title";
        titleEl.textContent = libConfig.title;

        Object.assign(titleEl.style, {
            position: "absolute",
            inset: "0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Inter, sans-serif",
            fontWeight: "700",
            fontSize: "clamp(1em, 14cqw, 3em)",
            color: "white",
            textShadow: "0 2px 10px rgba(0,0,0,.9)",
            zIndex: "5",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            padding: "0 8px",
            boxSizing: "border-box"
        });

        scalable.appendChild(img);
        scalable.appendChild(titleEl);

        // Force the browser to flush pending layout before we move on,
        // as extra insurance against any lingering stale-size timing
        // issues right after a card gets repopulated.
        void scalable.offsetHeight;

        state.img = img;
        state.titleEl = titleEl;

        // Reset slideshow position whenever the overlay is (re)created
        state.index = state.cache && state.cache.length
            ? Math.floor(Math.random() * state.cache.length)
            : 0;

        console.log(`[Backdrop] ${libConfig.title} overlay (re)attached`);
    }

    // Fetch (or reuse cached) backdrop/cover list for this library.
    // getImagesForLibrary itself only hits the API once per library id
    // ever, so calling this again on overlay recreation is cheap.
    if (!state.cache) {
        state.cache = await getImagesForLibrary(libConfig);
        state.index = state.cache.length
            ? Math.floor(Math.random() * state.cache.length)
            : 0;
    }

    if (!state.listenersAttached) {
        state.listenersAttached = true;

        card.addEventListener("mouseenter", () => {
            if (state.timer) return;
            state.img.style.opacity = "1";
            nextFrame(state);
            state.timer = setInterval(() => nextFrame(state), INTERVAL);
        });

        card.addEventListener("mouseleave", () => {
            clearInterval(state.timer);
            state.timer = null;
            state.img.style.opacity = "0";
            state.index = state.cache.length
                ? Math.floor(Math.random() * state.cache.length)
                : 0;
        });

        console.log(`[Backdrop] ${libConfig.title} listeners attached`);
    }
}

// =====================================================================
// Scans the current DOM for every configured library card and makes
// sure each one has its overlay + listeners. Safe to call as often as
// you like — ensureLibraryCard only does real work when something is
// actually missing.
//
// Logs are tagged "[Backdrop]" and only fire on state *changes* (a
// library's card newly found or newly missing) rather than every scan,
// so you can filter the devtools console by "[Backdrop]" and get a
// clean trail of exactly what happened around a failed navigation,
// without drowning in once-a-second noise.
// =====================================================================

const lastFound = new Map();

function scanForCards() {
    LIBRARIES.forEach(lib => {
        const card = document.querySelector(`.card[data-id="${lib.id}"]`);
        const found = !!card;

        if (lastFound.get(lib.id) !== found) {
            lastFound.set(lib.id, found);
            console.log(`[Backdrop] ${lib.title} card ${found ? "found" : "NOT found"} in DOM`);
        }

        if (card) {
            try {
                ensureLibraryCard(card, lib);
            } catch (err) {
                console.error(`[Backdrop] Error setting up ${lib.title}:`, err);
            }
        }
    });
}

// Initial pass, in case the cards are already present
scanForCards();

// Debug handle — see the block at the very top of this file for usage.
window.__backdropSlideshow = {
    loadedAt: Date.now(),
    scanForCards,
    lastFound
};

console.log("[Backdrop] Script fully initialized.");

// =====================================================================
// Re-scan whenever the app re-renders the page (SPA navigation swaps
// out the DOM, so cards you set up before get replaced with fresh,
// un-initialized ones).
//
// This is debounced so a burst of unrelated mutations elsewhere on the
// page (other rows/carousels loading, etc.) doesn't trigger a scan on
// every single change — but it's also *bounded*: if mutations keep
// happening continuously, a naive debounce could keep getting reset
// and never actually fire. maxWait guarantees a scan runs at least
// every 300ms no matter how noisy the page is.
// =====================================================================

let debounceTimer = null;
let lastScanAt = 0;
const DEBOUNCE_MS = 50;
const MAX_WAIT_MS = 300;

function scheduleScan() {
    const now = Date.now();
    clearTimeout(debounceTimer);

    if (now - lastScanAt >= MAX_WAIT_MS) {
        lastScanAt = now;
        scanForCards();
    } else {
        debounceTimer = setTimeout(() => {
            lastScanAt = Date.now();
            scanForCards();
        }, DEBOUNCE_MS);
    }
}

const observer = new MutationObserver(scheduleScan);

observer.observe(document.body, {
    childList: true,
    subtree: true
});

// =====================================================================
// Belt-and-suspenders: the MutationObserver catches most DOM swaps, but
// some navigations (e.g. the header Home button) route via history/hash
// changes that don't always produce a DOM mutation inside the debounce
// window in time. These extra triggers make sure we never miss it:
//
// 1. Listen directly for the actual navigation events.
// 2. A cheap periodic re-scan as a final safety net — scanForCards is
//    just a handful of querySelector calls and bails out instantly on
//    any card already set up, so this costs nothing noticeable. Skipped
//    while the tab is in the background/hidden to avoid burning CPU on
//    a tab you're not even looking at.
// =====================================================================

window.addEventListener("hashchange", scanForCards);
window.addEventListener("popstate", scanForCards);

// pushState/replaceState don't natively fire hashchange or popstate even
// when they change the URL — only real browser back/forward navigation
// or a direct assignment to location.hash does. SPA routers (possibly
// including Jellyfin's) commonly use pushState/replaceState directly, so
// we patch them to let us know when that happens too.
["pushState", "replaceState"].forEach(method => {
    const original = history[method];
    history[method] = function (...args) {
        const result = original.apply(this, args);
        scanForCards();
        return result;
    };
});

setInterval(() => {
    if (document.visibilityState === "visible")
        scanForCards();
}, 1000);

})();