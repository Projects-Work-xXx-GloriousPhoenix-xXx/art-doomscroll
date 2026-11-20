using ArtDoomscroll.API.Data;
using ArtDoomscroll.API.Entities;
using ArtDoomscroll.API.Enums;
using Microsoft.EntityFrameworkCore;

namespace ArtDoomscroll.API.Shared;

public static class ArtistProfileResolver
{
    public static async Task<(ArtistProfile Profile, bool IsNew)> FindOrCreateAsync(
        AppDoomscrollDbContext db, Platform platform, string externalId, string profileUrl,
        string? handle, string? displayName, string? avatarUrl, CancellationToken ct)
    {
        var profile = await db.ArtistProfiles
            .FirstOrDefaultAsync(ap => ap.Platform == platform && ap.ExternalId == externalId, ct);

        if (profile is not null)
        {
            profile.Handle = handle ?? profile.Handle;
            profile.DisplayName = displayName ?? profile.DisplayName;
            profile.AvatarUrl = avatarUrl ?? profile.AvatarUrl;
            profile.ProfileUrl = profileUrl;
            profile.UpdatedAt = DateTime.UtcNow;

            return (profile, false);
        }

        profile = new ArtistProfile
        {
            Platform = platform,
            ExternalId = externalId,
            ProfileUrl = profileUrl,
            Handle = handle,
            DisplayName = displayName,
            AvatarUrl = avatarUrl,
        };

        var artist = new Artist
        {
            DisplayName = displayName ?? handle ?? externalId,
            Profiles = [profile]
        };

        db.Artists.Add(artist);

        return (profile, true);
    }
}
