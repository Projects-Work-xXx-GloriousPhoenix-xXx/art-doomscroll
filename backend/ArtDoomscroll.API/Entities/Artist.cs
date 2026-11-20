namespace ArtDoomscroll.API.Entities;

public class Artist : BaseEntity
{
    public required string DisplayName { get; set; }
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;

    public List<ArtistProfile> Profiles { get; init; } = [];
}
