using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;
using ArtDoomscroll.API.Entities;
using ArtDoomscroll.API.Enums;
using ArtDoomscroll.API.Shared;
using Microsoft.EntityFrameworkCore;

namespace ArtDoomscroll.API.Features;

public static class AddArtist
{
    public record Request(Platform? Platform, string ExternalId, string ProfileUrl,
                          string? Handle, string? DisplayName, string? AvatarUrl, ArtistStatus? Status);

    public record Response(Guid ArtistId, Guid ProfileId, ArtistStatus Status, bool IsNew);

    public static void Map(IEndpointRouteBuilder app) => app.MapPost("/artists", Handle);

    private static async Task<IResult> Handle(Request req, AppDoomscrollDbContext db,
                                              ICurrentUser currentUser, CancellationToken ct)
    {
        var validationErrors = new Dictionary<string, string[]>();
        if (req.Platform is null)
        {
            validationErrors["platform"] = ["Required field"];
        }
        if (string.IsNullOrWhiteSpace(req.ExternalId))
        {
            validationErrors["externalId"] = ["Required field"];
        }
        if (string.IsNullOrWhiteSpace(req.ProfileUrl))
        {
            validationErrors["profileUrl"] = ["Required field"];
        }
        if (validationErrors.Count > 0)
        {
            return Results.ValidationProblem(validationErrors);
        }

        var platform = req.Platform!.Value;
        var (profile, profileIsNew) = await ArtistProfileResolver.FindOrCreateAsync(
            db, platform, req.ExternalId, req.ProfileUrl,
            req.Handle, req.DisplayName, req.AvatarUrl, ct);

        var userArtist = profileIsNew
            ? null
            : await db.UserArtists.FirstOrDefaultAsync(
                ua => ua.UserId == currentUser.UserId && ua.ArtistId == profile.ArtistId, ct);

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
        else if (req.Status is not null)
        {
            userArtist!.Status = req.Status.Value;
            userArtist.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);

        var response = new Response(profile.ArtistId, profile.Id, userArtist!.Status, isNew);
        return isNew
            ? Results.Created($"/artists/{profile.ArtistId}", response)
            : Results.Ok(response);
    }
}
