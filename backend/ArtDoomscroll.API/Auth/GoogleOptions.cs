using System.ComponentModel.DataAnnotations;

namespace ArtDoomscroll.API.Auth;

public sealed class GoogleOptions
{
    public const string SectionName = "Google";

    public string[] ClientIds { get; init; } = [];
}