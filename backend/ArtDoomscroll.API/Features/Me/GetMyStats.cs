using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;
using ArtDoomscroll.API.Enums;
using Microsoft.EntityFrameworkCore;

namespace ArtDoomscroll.API.Features.Me;

public static class GetMyStats
{
    public record Response(Dictionary<WorkStatus, int> Works, Dictionary<ArtistStatus, int> Artists);
    public static void Map(IEndpointRouteBuilder app) => app.MapGet("/me/stats", Handle);
    private static async Task<IResult> Handle(AppDoomscrollDbContext db, ICurrentUser currentUser, CancellationToken ct)
    {
        var userId = currentUser.UserId;

        var works = await db.UserWorks
            .Where(uw => uw.UserId == userId)
            .GroupBy(uw => uw.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var artists = await db.UserArtists
            .Where(ua => ua.UserId == userId)
            .GroupBy(ua => ua.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return Results.Ok(new Response(
            Enum.GetValues<WorkStatus>().ToDictionary(s => s, s => works.FirstOrDefault(w => w.Status == s)?.Count ?? 0),
            Enum.GetValues<ArtistStatus>().ToDictionary(s => s, s => artists.FirstOrDefault(a => a.Status == s)?.Count ?? 0)));
    }
}
