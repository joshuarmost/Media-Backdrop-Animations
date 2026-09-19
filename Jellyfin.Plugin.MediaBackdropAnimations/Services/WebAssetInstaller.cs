using System;
using System.IO;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Common.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.MediaBackdropAnimations.Services;

/// <summary>
/// Installs the web-client asset and registers it in Jellyfin's entry page.
/// </summary>
public sealed class WebAssetInstaller : IHostedService
{
    private const string Marker = "<!-- Media Backdrop Animations plugin -->";
    private const string ScriptTag = "<script defer src=\"plugins/media-backdrop-animations/backdrop-slideshow.js?v=1.0.0\"></script>";
    private const string ResourceName = "Jellyfin.Plugin.MediaBackdropAnimations.Web.backdrop-slideshow.js";

    private readonly IApplicationPaths _applicationPaths;
    private readonly ILogger<WebAssetInstaller> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="WebAssetInstaller"/> class.
    /// </summary>
    /// <param name="applicationPaths">The Jellyfin application paths.</param>
    /// <param name="logger">The plugin logger.</param>
    public WebAssetInstaller(IApplicationPaths applicationPaths, ILogger<WebAssetInstaller> logger)
    {
        _applicationPaths = applicationPaths;
        _logger = logger;
    }

    /// <inheritdoc />
    public Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            Install();
        }
        catch (Exception exception)
        {
            _logger.LogWarning(exception, "Unable to install Media Backdrop Animations into the Jellyfin web client.");
        }

        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private void Install()
    {
        if (string.IsNullOrWhiteSpace(_applicationPaths.WebPath))
        {
            _logger.LogWarning("Jellyfin has no web-client path; Media Backdrop Animations was not installed.");
            return;
        }

        var assetDirectory = Path.Combine(_applicationPaths.WebPath, "plugins", "media-backdrop-animations");
        Directory.CreateDirectory(assetDirectory);
        var assetPath = Path.Combine(assetDirectory, "backdrop-slideshow.js");

        using var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream(ResourceName)
            ?? throw new InvalidOperationException($"Embedded resource '{ResourceName}' was not found.");
        using var reader = new StreamReader(resource);
        File.WriteAllText(assetPath, reader.ReadToEnd(), new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));

        var indexPath = Path.Combine(_applicationPaths.WebPath, "index.html");
        if (!File.Exists(indexPath))
        {
            _logger.LogWarning("Jellyfin web-client entry page was not found at {IndexPath}.", indexPath);
            return;
        }

        var index = File.ReadAllText(indexPath);
        var block = string.Concat(Marker, Environment.NewLine, ScriptTag, Environment.NewLine);
        if (!index.Contains(Marker, StringComparison.Ordinal))
        {
            var bodyEnd = index.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
            index = bodyEnd >= 0
                ? index.Insert(bodyEnd, block)
                : string.Concat(index, Environment.NewLine, block);
            File.WriteAllText(indexPath, index, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
            _logger.LogInformation("Installed Media Backdrop Animations into {IndexPath}.", indexPath);
        }
        else
        {
            _logger.LogDebug("Media Backdrop Animations is already registered in {IndexPath}.", indexPath);
        }
    }
}
