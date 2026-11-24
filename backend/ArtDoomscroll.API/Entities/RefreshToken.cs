namespace ArtDoomscroll.API.Entities;

public class RefreshToken : BaseEntity
{
    public Guid UserId { get; init; }
    public User User { get; init; } = null!;
    public required string TokenHash { get; init; }
    public DateTime ExpiresAt { get; init; }
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
    public DateTime? RevokedAt { get; set; }
}