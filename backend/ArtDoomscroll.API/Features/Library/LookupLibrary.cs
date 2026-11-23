using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;
using ArtDoomscroll.API.Entities;
using ArtDoomscroll.API.Enums;
using Microsoft.EntityFrameworkCore;

namespace ArtDoomscroll.API.Features.Library;

public static class LookupLibrary
{
    private const int MaxItems = 100;
    public record Request(Platform? Platform, List<string>? Works, List<string>? Artists);
    public record WorkInfo(Guid WorkId, WorkStatus Status);
    public record ArtistInfo(Guid ArtistId, ArtistStatus Status);
    public record Response(Dictionary<string, WorkInfo> Works, Dictionary<string, ArtistInfo> Artists);

    public static void Map(IEndpointRouteBuilder app) => app.MapPost("/library/lookup", Handle);
    private static async Task<IResult> Handle(Request req, AppDoomscrollDbContext db, ICurrentUser currentUser, CancellationToken ct)
    {
        var validationErrors = new Dictionary<string, string[]>();
        if (req.Platform is null)
        {
            validationErrors.Add("platform", ["Required field"]);
        }
        if (req.Works?.Count > MaxItems)
        {
            validationErrors.Add("works", [$"Maximum {MaxItems} items"]);
        }
        if (req.Artists?.Count > MaxItems)
        {
            validationErrors.Add("artists", [$"Maximum {MaxItems} items"]);
        }
        if (validationErrors.Count != 0)
        {
            return Results.ValidationProblem(validationErrors);
        }

        var platform = req.Platform!.Value;
        var workIds = Clean(req.Works);
        var artistIds = Clean(req.Artists);

        static List<string> Clean(List<string>? ids) =>
            ids?.Where(s => !string.IsNullOrWhiteSpace(s)).Distinct().ToList() ?? [];


        var works = workIds.Count == 0
            ? []
            : await db.UserWorks
                .Where(uw => uw.UserId == currentUser.UserId
                    && uw.Work.Platform == platform
                    && workIds.Contains(uw.Work.ExternalId))
                .Select(uw => new { uw.Work.ExternalId, uw.WorkId, uw.Status })
                .ToDictionaryAsync(x => x.ExternalId, x => new WorkInfo(x.WorkId, x.Status), ct);

        var artists = artistIds.Count == 0
            ? []
            : await (
            from p in db.ArtistProfiles
            join ua in db.UserArtists on p.ArtistId equals ua.ArtistId
            where ua.UserId == currentUser.UserId
                && p.Platform == platform
                && artistIds.Contains(p.ExternalId)
            select new { p.ExternalId, ua.ArtistId, ua.Status })
            .ToDictionaryAsync(x => x.ExternalId, x => new ArtistInfo(x.ArtistId, x.Status), ct);

        return Results.Ok(new Response(works, artists));
    }
}
