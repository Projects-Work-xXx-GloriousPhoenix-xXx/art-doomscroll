using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;
using ArtDoomscroll.API.Enums;
using Microsoft.EntityFrameworkCore;

namespace ArtDoomscroll.API.Features.Works;

public static class LookupWork
{
    public record Query(Platform? Platform, string? ExternalId, string? ArtistExternalId);
    public record WorkInfo(Guid WorkId, WorkStatus Status);
    public record ArtistInfo(Guid ArtistId, ArtistStatus Status);
    public record Response(WorkInfo? Work, ArtistInfo? Artist);

    public static void Map(IEndpointRouteBuilder app) => app.MapGet("/works/lookup", Handle);
    private static async Task<IResult> Handle([AsParameters] Query q, AppDoomscrollDbContext db, ICurrentUser currentUser, CancellationToken ct)
    {
        var validationErrors = new Dictionary<string, string[]>();
        if (q.Platform is null)
        {
            validationErrors.Add("platform", ["Required field"]);
        }
        if (string.IsNullOrWhiteSpace(q.ExternalId))
        {
            validationErrors.Add("externalId", ["Required field"]);
        }
        if (validationErrors.Count != 0)
        {
            return Results.ValidationProblem(validationErrors);
        }

        var workInfo = await db.UserWorks
            .AsNoTracking()
            .Where(uw => uw.Work.Platform == q.Platform
                && uw.UserId == currentUser.UserId
                && uw.Work.ExternalId == q.ExternalId)
            .Select(uw => new WorkInfo(uw.WorkId, uw.Status))
            .FirstOrDefaultAsync(ct);

        var artistInfo = string.IsNullOrWhiteSpace(q.ArtistExternalId)
            ? null
            : await db.UserArtists
                .AsNoTracking()
                .Where(ua => ua.UserId == currentUser.UserId
                    && ua.Artist.Profiles.Any(p => p.Platform == q.Platform && p.ExternalId == q.ArtistExternalId))
                .Select(ua => new ArtistInfo(ua.ArtistId, ua.Status))
                .FirstOrDefaultAsync(ct);

        return Results.Ok(new Response(workInfo, artistInfo));
    }
}
