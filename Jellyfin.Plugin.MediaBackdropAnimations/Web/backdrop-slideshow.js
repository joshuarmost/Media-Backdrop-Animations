(() => {
    'use strict';

    const INSTANCE_KEY = '__mediaBackdropAnimations';
    const CONFIGURATION_PATH = '/MediaBackdropAnimations/Configuration';
    const OVERLAY_CLASS = 'media-backdrop-animations-image';

    if (window[INSTANCE_KEY]) {
        return;
    }

    const itemCache = new Map();
    const cardState = new WeakMap();
    const lastFound = new Map();
    let configuration;
    let scanTimer;
    let lastScanAt = 0;

    function log(level, ...args) {
        const logger = console[level] || console.log;
        logger.call(console, '[Media Backdrop Animations]', ...args);
    }

    function serverUrl() {
        return window.ApiClient && ApiClient._serverAddress ? ApiClient._serverAddress : '';
    }

    async function loadConfiguration() {
        const response = await fetch(serverUrl() + CONFIGURATION_PATH, { credentials: 'same-origin' });
        if (!response.ok) {
            throw new Error(`Configuration request failed (${response.status}).`);
        }

        return response.json();
    }

    function imageUrl(item, imageType) {
        const tag = imageType === 'Backdrop'
            ? ''
            : `&tag=${encodeURIComponent(item.ImageTags[imageType])}`;
        return `${serverUrl()}/Items/${item.Id}/Images/${imageType}?maxWidth=${configuration.ImageWidth}&quality=60${tag}`;
    }

    function shuffled(items) {
        const copy = items.slice();
        for (let index = copy.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
        }

        return copy;
    }

    async function getImagesForLibrary(library) {
        if (itemCache.has(library.Id)) {
            return itemCache.get(library.Id);
        }

        const query = {
            ParentId: library.Id,
            Recursive: true,
            Fields: library.ImageType === 'Backdrop' ? 'BackdropImageTags' : 'PrimaryImageAspectRatio',
            Limit: configuration.MaxItemsPerLibrary
        };
        if (library.IncludeItemTypes) {
            query.IncludeItemTypes = library.IncludeItemTypes;
        }

        const result = await ApiClient.getItems(ApiClient._serverInfo.UserId, query);
        const items = result.Items.filter(item => library.ImageType === 'Backdrop'
            ? item.BackdropImageTags && item.BackdropImageTags.length
            : item.ImageTags && item.ImageTags[library.ImageType]);
        const images = shuffled(items).map(item => {
            const image = new Image();
            image.src = imageUrl(item, library.ImageType);
            return image;
        });

        itemCache.set(library.Id, images);
        log('debug', `Prepared ${images.length} ${library.ImageType} image(s) for ${library.Title}.`);
        return images;
    }

    function nextFrame(state) {
        if (!state.images || state.images.length === 0) {
            return;
        }

        for (let attempts = 0; attempts < state.images.length; attempts += 1) {
            const image = state.images[state.index];
            state.index = (state.index + 1) % state.images.length;
            if (image.complete && image.naturalWidth > 0) {
                state.image.src = image.src;
                return;
            }
        }
    }

    function createOverlay(card, scalable, state, library) {
        scalable.style.position = 'relative';
        scalable.style.overflow = 'hidden';
        card.style.containerType = 'inline-size';

        const image = document.createElement('img');
        image.className = OVERLAY_CLASS;
        Object.assign(image.style, {
            position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover',
            zIndex: '1', opacity: '0', transition: 'opacity .3s ease', pointerEvents: 'none'
        });

        const title = document.createElement('div');
        title.className = 'media-backdrop-animations-title';
        title.textContent = library.Title;
        Object.assign(title.style, {
            position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Inter, sans-serif', fontWeight: '700', fontSize: 'clamp(1em, 14cqw, 3em)', color: 'white',
            textShadow: '0 2px 10px rgba(0,0,0,.9)', zIndex: '5', pointerEvents: 'none', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 8px', boxSizing: 'border-box'
        });

        scalable.append(image, title);
        state.image = image;
        state.title = title;
        state.index = state.images && state.images.length ? Math.floor(Math.random() * state.images.length) : 0;
    }

    async function ensureLibraryCard(card, library) {
        const scalable = card.querySelector('.cardScalable');
        if (!scalable) {
            return;
        }

        let state = cardState.get(card);
        if (!state) {
            state = { images: null, imagePromise: null, index: 0, timer: null, image: null, listenersAttached: false };
            cardState.set(card, state);
        }

        if (!state.image || !scalable.contains(state.image)) {
            createOverlay(card, scalable, state, library);
        }

        if (!state.imagePromise) {
            state.imagePromise = getImagesForLibrary(library)
                .then(images => {
                    state.images = images;
                    state.index = images.length ? Math.floor(Math.random() * images.length) : 0;
                })
                .catch(error => {
                    log('error', `Could not load artwork for ${library.Title}.`, error);
                    state.images = [];
                });
        }

        if (!state.listenersAttached) {
            state.listenersAttached = true;
            card.addEventListener('mouseenter', () => {
                if (state.timer || !state.image) {
                    return;
                }

                nextFrame(state);
                state.image.style.opacity = '1';
                state.timer = window.setInterval(() => nextFrame(state), configuration.IntervalMilliseconds);
            });
            card.addEventListener('mouseleave', () => {
                if (state.timer) {
                    window.clearInterval(state.timer);
                    state.timer = null;
                }

                if (state.image) {
                    state.image.style.opacity = '0';
                }
                if (state.images && state.images.length) {
                    state.index = Math.floor(Math.random() * state.images.length);
                }
            });
        }
    }

    function cardSelector(id) {
        return `.card[data-id="${CSS.escape(id)}"]`;
    }

    function scanForCards() {
        if (!configuration || !configuration.Enabled) {
            return;
        }

        configuration.Libraries.forEach(library => {
            const card = document.querySelector(cardSelector(library.Id));
            const found = Boolean(card);
            if (lastFound.get(library.Id) !== found) {
                lastFound.set(library.Id, found);
                log('debug', `${library.Title} card ${found ? 'found' : 'not found'}.`);
            }

            if (card) {
                ensureLibraryCard(card, library).catch(error => log('error', `Could not initialize ${library.Title}.`, error));
            }
        });
    }

    function scheduleScan() {
        const now = Date.now();
        window.clearTimeout(scanTimer);
        if (now - lastScanAt >= 300) {
            lastScanAt = now;
            scanForCards();
            return;
        }

        scanTimer = window.setTimeout(() => {
            lastScanAt = Date.now();
            scanForCards();
        }, 50);
    }

    async function start() {
        if (!window.ApiClient || !ApiClient._serverInfo || !ApiClient._serverInfo.UserId) {
            window.setTimeout(start, 100);
            return;
        }

        try {
            configuration = await loadConfiguration();
            if (!configuration.Enabled) {
                log('debug', 'Disabled in plugin settings.');
                return;
            }

            window[INSTANCE_KEY] = { loadedAt: Date.now(), scanForCards, lastFound };
            scanForCards();
            new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });
            window.addEventListener('hashchange', scanForCards);
            window.addEventListener('popstate', scanForCards);
            window.setInterval(() => {
                if (document.visibilityState === 'visible') {
                    scanForCards();
                }
            }, 1000);
            log('debug', 'Loaded.');
        } catch (error) {
            log('error', 'Could not load plugin configuration.', error);
        }
    }

    start();
})();
