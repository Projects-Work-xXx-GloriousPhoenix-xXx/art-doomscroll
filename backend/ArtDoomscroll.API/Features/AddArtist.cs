using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;
using ArtDoomscroll.API.Entities;
using ArtDoomscroll.API.Enums;
using Microsoft.EntityFrameworkCore;

namespace ArtDoomscroll.API.Features;

public static class AddArtist
{
    public record Request(Platform Platform, string ExternalId, string ProfileUrl,
                          string? Handle, string? DisplayName, string? AvatarUrl, ArtistStatus? Status);

    public record Response(Guid ArtistId, Guid ProfileId, ArtistStatus Status, bool IsNew);

    public static void Map(IEndpointRouteBuilder app) => app.MapPost("/artists", Handle);

    private static async Task<IResult> Handle(Request req, AppDoomscrollDbContext db,
                                              ICurrentUser currentUser, CancellationToken ct)
    {
        var validationErrors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(req.ExternalId))
        {
            validationErrors["ExternalId"] = ["Required field"];
        }
        if (string.IsNullOrWhiteSpace(req.ProfileUrl))
        {
            validationErrors["ProfileUrl"] = ["Required field"];
        }
        if (validationErrors.Count > 0)
        {
            return Results.ValidationProblem(validationErrors);
        }

        var profile = await db.ArtistProfiles
            .FirstOrDefaultAsync(a => a.Platform == req.Platform && a.ExternalId == req.ExternalId, ct);

        if (profile is null)
        {
            profile = new ArtistProfile
            {
                Platform = req.Platform,
                ExternalId = req.ExternalId,
                ProfileUrl = req.ProfileUrl,
                Handle = req.Handle,
                DisplayName = req.DisplayName,
                AvatarUrl = req.AvatarUrl,
            };

            db.Artists.Add(new Artist
            {
                DisplayName = req.DisplayName ?? req.Handle ?? req.ExternalId,
                Profiles = [profile]
            });
        }
        else
        {
            profile.Handle = req.Handle ?? profile.Handle;
            profile.DisplayName = req.DisplayName ?? profile.DisplayName;
            profile.AvatarUrl = req.AvatarUrl ?? profile.AvatarUrl;
            profile.ProfileUrl = req.ProfileUrl;
            profile.UpdatedAt = DateTime.UtcNow;
        }

        var userArtist = await db.UserArtists
            .FirstOrDefaultAsync(ua => ua.UserId == currentUser.UserId && ua.ArtistId == profile.ArtistId, ct);

        var isNew = userArtist is null;

        if (isNew)
        {
            userArtist = new UserArtist
            {
                UserId = currentUser.UserId,
                ArtistId = profile.ArtistId,
                Status = req.Status ?? ArtistStatus.Queued
            };

            db.UserArtists.Add(userArtist);
        }

        await db.SaveChangesAsync(ct);

        if (isNew)
        {
            return Results.Created($"/artists/{profile.ArtistId}", new Response(profile.ArtistId, profile.Id, userArtist!.Status, true));
        }

        return Results.Ok(new Response(profile.ArtistId, profile.Id, userArtist!.Status, false));
    }
}
