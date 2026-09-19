using System.Collections.ObjectModel;
using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.MediaBackdropAnimations.Configuration;

/// <summary>
/// Plugin configuration.
/// </summary>
public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>
    /// Gets or sets a value indicating whether animations are enabled.
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Gets or sets the interval, in milliseconds, between images while hovering.
    /// </summary>
    public int IntervalMilliseconds { get; set; } = 300;

    /// <summary>
    /// Gets or sets the maximum width requested for each image.
    /// </summary>
    public int ImageWidth { get; set; } = 448;

    /// <summary>
    /// Gets or sets the maximum number of candidate images fetched per library.
    /// </summary>
    public int MaxItemsPerLibrary { get; set; } = 60;

    /// <summary>
    /// Gets or sets the library cards that receive animated artwork.
    /// </summary>
    #pragma warning disable CA2227, CA1002 // Plugin configuration requires a settable, XML-serializable collection.
    public Collection<LibraryCardConfiguration> Libraries { get; set; } = new()
    {
        new() { Id = "f137a2dd21bbc1b99aa5c0f6bf02a805", Title = "Movies", IncludeItemTypes = "Movie", ImageType = "Backdrop" },
        new() { Id = "a656b907eb3a73532e40e44b968d0225", Title = "Shows", IncludeItemTypes = "Series", ImageType = "Backdrop" },
        new() { Id = "9d7ad6afe9afa2dab1a2f6e00ad28fa6", Title = "Collections", IncludeItemTypes = "BoxSet", ImageType = "Backdrop" },
        new() { Id = "7e64e319657a9516ec78490da03edccb", Title = "Music", ImageType = "Primary" },
        new() { Id = "4e985111ed7f570b595204d82adb02f3", Title = "Books", IncludeItemTypes = "Book", ImageType = "Primary" },
        new() { Id = "c0c1444b416777d3fa55d5f13da1ce58", Title = "Audiobooks", IncludeItemTypes = "AudioBook", ImageType = "Primary" },
        new() { Id = "6f6c941d77cac5227434dea56b095315", Title = "Playlists", IncludeItemTypes = "Playlist", ImageType = "Primary" }
    };
    #pragma warning restore CA2227, CA1002
}
