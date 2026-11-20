using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;
using ArtDoomscroll.API.Enums;
using ArtDoomscroll.API.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileSystemGlobbing.Internal;

namespace ArtDoomscroll.API.Features.Artists;

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

    public record Query(
        int Page = 1,
        int PageSize = 10,
        ArtistStatus? Status = null,
        Platform? Platform = null,
        string? Search = null);

    public static void Map(IEndpointRouteBuilder app) => app.MapGet("/artists", Handle);
    private static async Task<IResult> Handle([AsParameters] Query q,
        AppDoomscrollDbContext db, ICurrentUser currentUser, CancellationToken ct)
    {
        var page = Math.Max(q.Page, 1);
        var pageSize = Math.Clamp(q.PageSize, 1, 100);

        var query = db.UserArtists
            .AsNoTracking()
            .Where(ua => ua.UserId == currentUser.UserId);

        if (q.Status is not null)
        {
            query = query.Where(ua => ua.Status == q.Status);
        }

        if (q.Platform is not null)
        {
            query = query.Where(ua => ua.Artist.Profiles.Any(p => p.Platform == q.Platform));
        }

        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var pattern = $"%{q.Search.Trim()}%";
            query = query.Where(ua =>
                EF.Functions.ILike(ua.Artist.DisplayName, pattern) ||
                ua.Artist.Profiles.Any(p =>
                    EF.Functions.ILike(p.Handle!, pattern) ||
                    EF.Functions.ILike(p.DisplayName!, pattern)));
        }

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
