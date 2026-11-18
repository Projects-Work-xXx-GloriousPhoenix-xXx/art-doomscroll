using ArtDoomscroll.API.Enums;

namespace ArtDoomscroll.API.Entities;

public class UserArtist
{
    public Guid UserId { get; init; }
    public User User { get; init; } = null!;
    public Guid ArtistId { get; set; }
    public Artist Artist { get; set; } = null!;

    public ArtistStatus Status { get; set; } = ArtistStatus.Queued;
    public string? Note { get; set; }
    public DateTime AddedAt { get; init; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
