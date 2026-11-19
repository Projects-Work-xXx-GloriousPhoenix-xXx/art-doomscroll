using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;
using ArtDoomscroll.API.Enums;
using ArtDoomscroll.API.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArtDoomscroll.API.Features;

public static class ListArtists
{
    public record ArtistProfileDto(Platform Platform, string? Handle, string ProfileUrl, string? AvatarUrl);

    public record ArtistDto(
        Guid Id,
        string DisplayName,
        ArtistStatus Status,
        string? Note,
        DateTime AddedAt,
        List<ArtistProfileDto> Profiles);

    public static void Map(IEndpointRouteBuilder app) => app.MapGet("/artists", Handle);
    private static async Task<IResult> Handle(AppDoomscrollDbContext db, ICurrentUser currentUser, CancellationToken ct,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.UserArtists
            .AsNoTracking()
            .Where(ua => ua.UserId == currentUser.UserId);

        var totalCount = await query.CountAsync(ct);
        
        var items = await query
            .OrderByDescending(ua => ua.AddedAt)
            .ThenBy(ua => ua.ArtistId)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(ua => new ArtistDto(
                Id: ua.Artist.Id,
                DisplayName: ua.Artist.DisplayName,
                Status: ua.Status,
                Note: ua.Note,
                AddedAt: ua.AddedAt,
                Profiles: ua.Artist.Profiles.Select(p => new ArtistProfileDto(
                    Platform: p.Platform,
                    Handle: p.Handle,
                    ProfileUrl: p.ProfileUrl,
                    AvatarUrl: p.AvatarUrl
                )).ToList()
            ))
            .ToListAsync(ct);

        return Results.Ok(new Page<ArtistDto>(page, pageSize, totalCount, items));
    }
}
