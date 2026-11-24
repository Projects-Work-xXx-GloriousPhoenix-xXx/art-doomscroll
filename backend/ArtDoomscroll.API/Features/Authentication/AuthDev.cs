using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;

namespace ArtDoomscroll.API.Features.Authentication;

public static class AuthDev
{
    public record Response(string AccessToken, DateTime AccessTokenExpiresAt, string RefreshToken);

    public static void Map(IEndpointRouteBuilder app) => app.MapPost("/auth/dev", Handle).AllowAnonymous();

    private static async Task<IResult> Handle(AppDoomscrollDbContext db, TokenService tokens, CancellationToken ct)
    {
        var issued = tokens.Issue(DevCurrentUser.DevUserId);
        await db.SaveChangesAsync(ct);
        return Results.Ok(new Response(issued.AccessToken, issued.AccessTokenExpiresAt, issued.RefreshToken));
    }
}
