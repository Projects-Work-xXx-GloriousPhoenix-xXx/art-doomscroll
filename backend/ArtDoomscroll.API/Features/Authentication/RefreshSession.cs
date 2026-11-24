using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;
using Microsoft.EntityFrameworkCore;

namespace ArtDoomscroll.API.Features.Authentication;

public static class RefreshSession
{
    public record Request(string? RefreshToken);
    public record Response(string AccessToken, DateTime AccessTokenExpiresAt, string RefreshToken);
    public static void Map(IEndpointRouteBuilder app) => app.MapPost("/auth/refresh", Handle).AllowAnonymous();
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

        var refreshToken = req.RefreshToken!;
        var hash = TokenService.Hash(refreshToken);
        var stored = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (stored is null) return Results.Unauthorized();

        var now = time.GetUtcNow().UtcDateTime;
        if (stored.RevokedAt is not null)
        {
            await db.RefreshTokens
                .Where(t => t.UserId == stored.UserId && t.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);
            return Results.Unauthorized();
        }

        if (stored.ExpiresAt <= now) return Results.Unauthorized();

        stored.RevokedAt = now;
        var issued = tokens.Issue(stored.UserId);
        await db.SaveChangesAsync(ct);

        return Results.Ok(new Response(issued.AccessToken, issued.AccessTokenExpiresAt, issued.RefreshToken));
    }
}
