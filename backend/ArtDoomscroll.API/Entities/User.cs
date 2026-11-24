namespace ArtDoomscroll.API.Entities;

public class User : BaseEntity
{
    public required string DisplayName { get; set; }
    public required string Email { get; set; }
    public string? AvatarUrl { get; set; }
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;

    public ICollection<UserLogin> Logins { get; init; } = [];
    public ICollection<RefreshToken> RefreshTokens { get; init; } = [];
}
