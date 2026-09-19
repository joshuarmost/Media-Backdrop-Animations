using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.MediaBackdropAnimations.Api;

/// <summary>
/// Provides the non-sensitive settings required by the web-client asset.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("MediaBackdropAnimations/Configuration")]
public sealed class ConfigurationController : ControllerBase
{
    /// <summary>
    /// Gets the settings used by the client-side slideshow.
    /// </summary>
    /// <returns>The client-safe plugin configuration.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(ClientConfiguration), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public ActionResult<ClientConfiguration> Get()
    {
        var configuration = Plugin.Instance?.Configuration;
        if (configuration is null)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable);
        }

        return Ok(new ClientConfiguration(configuration));
    }
}
