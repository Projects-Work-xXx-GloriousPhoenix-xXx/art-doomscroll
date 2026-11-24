using System.IdentityModel.Tokens.Jwt;

namespace ArtDoomscroll.API.Auth;

public sealed class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public Guid UserId
    {
        get
        {
            var sub = accessor.HttpContext?.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
            return Guid.TryParse(sub, out var id)
                ? id
                : throw new InvalidOperationException("No authenticated user");
        }
    }
}
