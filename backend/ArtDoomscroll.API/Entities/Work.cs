using ArtDoomscroll.API.Enums;

namespace ArtDoomscroll.API.Entities;

public class Work : BaseEntity
{
    public Guid ArtistProfileId { get; init; }
    public ArtistProfile ArtistProfile { get; init; } = null!;

    public required Platform Platform { get; init; }
    public required string ExternalId { get; init; }
    public required string Url { get; set; }
    public string? Title { get; set; }
    public string? ThumbnailUrl { get; set; }
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
}
