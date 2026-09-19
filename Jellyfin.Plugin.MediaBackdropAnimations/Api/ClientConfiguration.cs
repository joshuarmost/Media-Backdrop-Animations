using System;
using System.Collections.Generic;
using System.Linq;
using Jellyfin.Plugin.MediaBackdropAnimations.Configuration;

namespace Jellyfin.Plugin.MediaBackdropAnimations.Api;

/// <summary>
/// The public subset of configuration consumed by the web client.
/// </summary>
public sealed class ClientConfiguration
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ClientConfiguration"/> class.
    /// </summary>
    /// <param name="configuration">The persisted plugin configuration.</param>
    public ClientConfiguration(PluginConfiguration configuration)
    {
        Enabled = configuration.Enabled;
        IntervalMilliseconds = Math.Clamp(configuration.IntervalMilliseconds, 100, 10000);
        ImageWidth = Math.Clamp(configuration.ImageWidth, 64, 1920);
        MaxItemsPerLibrary = Math.Clamp(configuration.MaxItemsPerLibrary, 1, 500);
        Libraries = configuration.Libraries
            .Where(library => !string.IsNullOrWhiteSpace(library.Id) && !string.IsNullOrWhiteSpace(library.Title))
            .Select(library => new LibraryCardConfiguration
            {
                Id = library.Id,
                Title = library.Title,
                IncludeItemTypes = library.IncludeItemTypes,
                ImageType = string.Equals(library.ImageType, "Primary", StringComparison.OrdinalIgnoreCase) ? "Primary" : "Backdrop"
            })
            .ToList();
    }

    /// <summary>Gets a value indicating whether the enhancement is enabled.</summary>
    public bool Enabled { get; }

    /// <summary>Gets the hover animation interval.</summary>
    public int IntervalMilliseconds { get; }

    /// <summary>Gets the requested image width.</summary>
    public int ImageWidth { get; }

    /// <summary>Gets the per-library candidate image limit.</summary>
    public int MaxItemsPerLibrary { get; }

    /// <summary>Gets the configured library cards.</summary>
    public IReadOnlyList<LibraryCardConfiguration> Libraries { get; }
}
