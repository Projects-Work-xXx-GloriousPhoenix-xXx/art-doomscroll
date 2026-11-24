using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;
using Microsoft.EntityFrameworkCore;

namespace ArtDoomscroll.API.Features.Authentication;

public static class Logout
{
    public record Request(string? RefreshToken);
    public static void Map(IEndpointRouteBuilder app) => app.MapPost("/auth/logout", Handle).AllowAnonymous();
    private static async Task<IResult> Handle(Request req, AppDoomscrollDbContext db, TokenService tokens, TimeProvider time, CancellationToken ct)
    {
        var validationErrors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(req.RefreshToken))
        {
            validationErrors.Add("refreshToken", ["Required field"]);
        }
        if (validationErrors.Count != 0)
        {
            return Results.ValidationProblem(validationErrors);
        }

        var now = time.GetUtcNow().UtcDateTime;
        var hash = TokenService.Hash(req.RefreshToken!);
        await db.RefreshTokens
            .Where(t => t.TokenHash == hash && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);

        return Results.NoContent();
    }
}
