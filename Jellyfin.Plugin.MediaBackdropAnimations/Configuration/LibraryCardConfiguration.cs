namespace Jellyfin.Plugin.MediaBackdropAnimations.Configuration;

/// <summary>
/// A configured Jellyfin library card.
/// </summary>
public sealed class LibraryCardConfiguration
{
    /// <summary>
    /// Gets or sets the Jellyfin library identifier.
    /// </summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the title shown over the card.
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the optional Jellyfin item type used to select images.
    /// </summary>
    public string? IncludeItemTypes { get; set; }

    /// <summary>
    /// Gets or sets the image type to use: Backdrop or Primary.
    /// </summary>
    public string ImageType { get; set; } = "Backdrop";
}
