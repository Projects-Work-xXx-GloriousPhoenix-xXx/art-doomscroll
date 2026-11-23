namespace ArtDoomscroll.API.Entities;

public class UserLogin : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public required string Provider { get; init; }
    public required string ProviderKey { get; init; }
}
