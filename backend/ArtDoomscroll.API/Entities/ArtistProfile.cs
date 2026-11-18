using ArtDoomscroll.API.Enums;

namespace ArtDoomscroll.API.Entities;

public class ArtistProfile : BaseEntity
{
    public Guid ArtistId { get; set; }
    public Artist Artist { get; set; } = null!;

    public required Platform Platform { get; init; }
    public required string ExternalId { get; init; }
    public required string ProfileUrl { get; set; }
    public string? Handle { get; set; }
    public string? DisplayName { get; set; }
    public string? AvatarUrl { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<Work> Works { get; init; } = [];
}
