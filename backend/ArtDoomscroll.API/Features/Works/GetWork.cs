using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;
using ArtDoomscroll.API.Enums;
using Microsoft.EntityFrameworkCore;

namespace ArtDoomscroll.API.Features.Works;

public static class GetWork
{
    public record WorkArtistDto(
        Guid Id,
        string DisplayName,
        string? Handle,
        string ProfileUrl,
        string? AvatarUrl,
        ArtistStatus? Status);

    public record LibraryDto(WorkStatus Status, DateTime AddedAt);

    public record Response(
        Guid Id,
        Platform Platform,
        string Url,
        string? Title,
        string? ThumbnailUrl,
        LibraryDto? Library,
        WorkArtistDto Artist);

    public static void Map(IEndpointRouteBuilder app) => app.MapGet("/works/{id:guid}", Handle);
    private static async Task<IResult> Handle(Guid id, AppDoomscrollDbContext db, ICurrentUser currentUser, CancellationToken ct)
    {
        var response = await db.Works
            .AsNoTracking()
            .Where(w => w.Id == id)
            .Select(w => new Response(
                w.Id,
                w.ArtistProfile.Platform,
                w.Url,
                w.Title,
                w.ThumbnailUrl,
                db.UserWorks
                    .Where(uw => uw.WorkId == w.Id && uw.UserId == currentUser.UserId)
                    .Select(uw => new LibraryDto(uw.Status, uw.AddedAt))
                    .FirstOrDefault(),
                new WorkArtistDto(
                    Id: w.ArtistProfile.ArtistId,
                    DisplayName: w.ArtistProfile.Artist.DisplayName,
                    Handle: w.ArtistProfile.Handle,
                    ProfileUrl: w.ArtistProfile.ProfileUrl,
                    AvatarUrl: w.ArtistProfile.AvatarUrl,
                    Status: db.UserArtists
                        .Where(ua => ua.UserId == currentUser.UserId && ua.ArtistId == w.ArtistProfile.ArtistId)
                        .Select(ua => (ArtistStatus?)ua.Status)
                        .FirstOrDefault())
            ))
            .FirstOrDefaultAsync(ct);

        if (response is null)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Work not found",
                detail: $"Work with id '{id}' was not found.");
        }

        return Results.Ok(response);
    }
}
