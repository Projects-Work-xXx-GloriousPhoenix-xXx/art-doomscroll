using System.ComponentModel.DataAnnotations;

namespace ArtDoomscroll.API.Auth;

public sealed class GoogleOptions
{
    public const string SectionName = "Google";

    [MinLength(1)]
    public string[] ClientIds { get; init; } = [];
}