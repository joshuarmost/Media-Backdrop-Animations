# Media Backdrop Animations

Media Backdrop Animations adds a fast artwork slideshow to selected library cards on the Jellyfin web home screen. On hover, the card cycles through randomly shuffled backdrop art (or primary art for libraries such as music, books, and playlists).

## What it does

- Loads once with the Jellyfin web client; no browser extension or custom-script injector is needed.
- Reattaches itself after Jellyfin's single-page-app navigation rerenders a home screen.
- Caches and preloads a bounded set of images for each configured library during a browser session.
- Lets an administrator add, remove, and edit library card IDs, names, item types, image type, preload size, and animation speed in Dashboard.

The initial settings preserve the library IDs and behavior from the original `script.js`. Change these on the plugin configuration page if your server or library IDs differ.

## Requirements

- Jellyfin Server 10.11.x, using the web client.
- .NET 9 SDK to build from source.
- The Jellyfin service account must be able to write its `web` directory and `web/index.html`. This is normally true on Windows installs. For Docker or Linux package installs, the web directory is often root-owned and must be made writable before the plugin can install its client asset.

This enhancement is for Jellyfin Web. Native TV, mobile, Roku, and desktop clients do not load the browser script.

## Build

```powershell
dotnet restore Jellyfin.Plugin.MediaBackdropAnimations.slnx
dotnet build Jellyfin.Plugin.MediaBackdropAnimations.slnx -c Release
```

The plugin assembly is written to `Jellyfin.Plugin.MediaBackdropAnimations/bin/Release/net9.0/Jellyfin.Plugin.MediaBackdropAnimations.dll`.

## Install and configure

1. Stop Jellyfin.
2. Create a folder such as `MediaBackdropAnimations_1.0.0.0` beneath Jellyfin's plugins directory and place the built DLL there.
3. Start Jellyfin. The plugin installs `backdrop-slideshow.js` in Jellyfin Web and adds one marked script tag to `index.html`.
4. In Jellyfin, open Dashboard > Plugins > Media Backdrop Animations.
5. Verify each library card ID, title, item type, and art type. Save, then refresh Jellyfin in each browser.

If an older manual injector is still loading `script.js`, remove that injected script before enabling this plugin; otherwise both implementations will try to decorate the same cards.

## Troubleshooting

- **No slideshow:** Check the Jellyfin server log for `Media Backdrop Animations`. A warning about the web directory indicates missing write permission. Also hard-refresh the browser after the first server restart.
- **A card is unchanged:** Verify its `data-id` matches the library ID configured in the plugin, and that it has items with the selected image type.
- **Animation is too demanding:** Increase the frame interval or reduce Images per library in the plugin settings.
- **After a Jellyfin update:** Restart Jellyfin. The plugin re-copies its web asset and restores its script tag when the web client update replaced `index.html`.

## Technical note

Jellyfin does not currently expose a stable official API for extending arbitrary web-client pages. The plugin therefore uses the same startup-time web asset installation pattern used by community web UI plugins. It modifies only its marked script block in the Jellyfin web entry page and does not alter Jellyfin application code.
