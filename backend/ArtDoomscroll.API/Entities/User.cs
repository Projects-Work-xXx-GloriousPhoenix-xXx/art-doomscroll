namespace ArtDoomscroll.API.Entities;

public class User : BaseEntity
{
    public required string DisplayName { get; set; }
    public string? Email { get; set; }
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
}
