using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;
using ArtDoomscroll.API.Entities;
using ArtDoomscroll.API.Enums;
using ArtDoomscroll.API.Shared;
using Microsoft.EntityFrameworkCore;

namespace ArtDoomscroll.API.Features;

public static class AddWork
{
    public record Request(Platform? Platform, string? ExternalId, string? Url, string? Title, string? ThumbnailUrl, WorkStatus? Status, ArtistData Artist);
    public record ArtistData(string? ExternalId, string? ProfileUrl, string? Handle, string? DisplayName, string? AvatarUrl);
    public record Response(Guid WorkId, Guid ArtistId, WorkStatus Status, bool IsNew, ArtistStatus? ArtistStatus);
    public static void Map(IEndpointRouteBuilder app) => app.MapPost("/works", Handle);
    private static async Task<IResult> Handle(Request req, AppDoomscrollDbContext db, ICurrentUser currentUser, CancellationToken ct)
    {
        var validationErrors = new Dictionary<string, string[]>();
        if (req.Platform is null)
        {
            validationErrors.Add("platform", ["Required field"]);
        }
        if (string.IsNullOrWhiteSpace(req.ExternalId))
        {
            validationErrors.Add("externalId", ["Required field"]);
        }
        if (string.IsNullOrWhiteSpace(req.Url))
        {
            validationErrors.Add("url", ["Required field"]);
        }
        if (req.Artist is null)
        {
            validationErrors.Add("artist", ["Required field"]);
        }
        else
        {
            if (string.IsNullOrWhiteSpace(req.Artist.ExternalId))
            {
                validationErrors.Add("artist.externalId", ["Required field"]);
            }
            if (string.IsNullOrWhiteSpace(req.Artist.ProfileUrl))
            {
                validationErrors.Add("artist.profileUrl", ["Required field"]);
            }
        }
        if (validationErrors.Count != 0)
        {
            return Results.ValidationProblem(validationErrors);
        }

        var artist = req.Artist!;
        var platform = req.Platform!.Value;
        var (profile, profileIsNew) = await ArtistProfileResolver.FindOrCreateAsync(db, platform, artist.ExternalId!, artist.ProfileUrl!, artist.Handle, artist.DisplayName, artist.AvatarUrl, ct);
        
        var work = await db.Works.FirstOrDefaultAsync(w => w.Platform == platform && w.ExternalId == req.ExternalId, ct);
        if (work is null)
        {
            work = new Work
            {
                Platform = platform,
                ExternalId = req.ExternalId!,
                Url = req.Url!,
                Title = req.Title,
                ThumbnailUrl = req.ThumbnailUrl,
                ArtistProfile = profile
            };

            db.Works.Add(work);
        }
        else
        {
            work.Title = req.Title ?? work.Title;
            work.ThumbnailUrl = req.ThumbnailUrl ?? work.ThumbnailUrl;
            work.Url = req.Url!;
        }

        var userWork = await db.UserWorks.FirstOrDefaultAsync(uw => uw.UserId == currentUser.UserId && uw.WorkId == work.Id, ct);
        var isNew = userWork is null;
        if (isNew)
        {
            userWork = new UserWork
            {
                UserId = currentUser.UserId,
                Work = work,
                Status = req.Status ?? WorkStatus.Queued
            };

            db.UserWorks.Add(userWork);
        }
        else if (req.Status is not null)
        {
            userWork!.Status = req.Status.Value;
            userWork.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);

        var artistStatus = profileIsNew
            ? null
            : await db.UserArtists
                .Where(ua => ua.UserId == currentUser.UserId && ua.ArtistId == profile.ArtistId)
                .Select(ua => (ArtistStatus?)ua.Status)
                .FirstOrDefaultAsync(ct);


        var response = new Response(work.Id, profile.ArtistId, userWork!.Status, isNew, artistStatus);
        return isNew
            ? Results.Created($"/works/{work.Id}", response)
            : Results.Ok(response);
    }
}