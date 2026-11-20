namespace ArtDoomscroll.API.Auth;

public sealed class DevCurrentUser : ICurrentUser
{
    public static readonly Guid DevUserId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    public Guid UserId => DevUserId;
}
