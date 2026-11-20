using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;
using ArtDoomscroll.API.Enums;
using Microsoft.EntityFrameworkCore;

namespace ArtDoomscroll.API.Features;

public static class GetArtist
{
    public record ProfileDto(
        Guid Id,
        Platform Platform,
        string? Handle,
        string? DisplayName,
        string ProfileUrl,
        string? AvatarUrl);

    public record LibraryDto(
        ArtistStatus Status,
        string? Note,
        DateTime AddedAt);

    public record WorkCountsDto(
        int Queued,
        int Liked,
        int Disliked);

    public record Response(
        Guid Id,
        string DisplayName,
        List<ProfileDto> Profiles,
        LibraryDto? Library,
        WorkCountsDto WorkCounts);

    public static void Map(IEndpointRouteBuilder app) => app.MapGet("/artists/{id:guid}", Handle);
    private static async Task<IResult> Handle(Guid id, AppDoomscrollDbContext db, ICurrentUser currentUser, CancellationToken ct)
    {
        var response = await db.Artists
            .Where(a => a.Id == id)
            .Select(a => new Response(
                a.Id,
                a.DisplayName,
                a.Profiles.Select(p => new ProfileDto(p.Id, p.Platform, p.Handle, p.DisplayName, p.ProfileUrl, p.AvatarUrl)).ToList(),
                db.UserArtists
                    .Where(ua => ua.ArtistId == a.Id && ua.UserId == currentUser.UserId)
                    .Select(ua => new LibraryDto(ua.Status, ua.Note, ua.AddedAt))
                    .FirstOrDefault(),
                new WorkCountsDto(0, 0, 0)
            ))
            .FirstOrDefaultAsync(ct);

        if (response is null)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Artist not found",
                detail: $"No artist with ID '{id}' was found.");
        }

        var counts = await db.UserWorks
            .Where(uw => uw.UserId == currentUser.UserId && uw.Work.ArtistProfile.ArtistId == id)
            .GroupBy(uw => uw.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Status, x => x.Count, ct);

        var workCounts = new WorkCountsDto(
            counts.GetValueOrDefault(WorkStatus.Queued),
            counts.GetValueOrDefault(WorkStatus.Liked),
            counts.GetValueOrDefault(WorkStatus.Disliked));

        return Results.Ok(response with { WorkCounts = workCounts });
    }
}
