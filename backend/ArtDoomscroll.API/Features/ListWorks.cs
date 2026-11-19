using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;
using ArtDoomscroll.API.Enums;
using ArtDoomscroll.API.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Net.NetworkInformation;

namespace ArtDoomscroll.API.Features;

public static class ListWorks
{
    public record WorkArtistDto(
        Guid Id,
        string DisplayName,
        string? Handle,
        string ProfileUrl,
        string? AvatarUrl,
        ArtistStatus? Status);

    public record WorkDto(
        Guid Id,
        Platform Platform,
        string Url,
        string? Title,
        string? ThumbnailUrl,
        WorkStatus Status,
        DateTime AddedAt,
        WorkArtistDto Artist);

    public record Query(
        int Page = 1,
        int PageSize = 10,
        WorkStatus? Status = null,
        Platform? Platform = null,
        Guid? ArtistId = null,
        string? Search = null);

    public static void Map(IEndpointRouteBuilder app) => app.MapGet("/works", Handle);
    private static async Task<IResult> Handle([AsParameters] Query q,
        AppDoomscrollDbContext db, ICurrentUser currentUser, CancellationToken ct)
    {
        var page = Math.Max(q.Page, 1);
        var pageSize = Math.Clamp(q.PageSize, 1, 100);

        var query = db.UserWorks
            .AsNoTracking()
            .Where(uw => uw.UserId == currentUser.UserId);

        if (q.Status is not null)
        {
            query = query.Where(uw => uw.Status == q.Status);
        }

        if (q.Platform is not null)
        {
            query = query.Where(uw => uw.Work.Platform == q.Platform);
        }

        if (q.ArtistId is not null)
        {
            query = query.Where(uw => uw.Work.ArtistProfile.ArtistId == q.ArtistId);
        }

        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var pattern = $"%{q.Search.Trim()}%";
            query = query.Where(uw =>
                EF.Functions.ILike(uw.Work.Title!, pattern) ||
                EF.Functions.ILike(uw.Work.ArtistProfile.Artist.DisplayName, pattern) ||
                EF.Functions.ILike(uw.Work.ArtistProfile.Handle!, pattern));
        }

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(uw => uw.AddedAt)
            .ThenBy(uw => uw.WorkId)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(uw => new WorkDto(
                Id: uw.Work.Id,
                Platform: uw.Work.Platform,
                Url: uw.Work.Url,
                Title: uw.Work.Title,
                ThumbnailUrl: uw.Work.ThumbnailUrl,
                Status: uw.Status,
                AddedAt: uw.AddedAt,
                Artist: new WorkArtistDto(
                    Id: uw.Work.ArtistProfile.ArtistId,
                    DisplayName: uw.Work.ArtistProfile.Artist.DisplayName,
                    Handle: uw.Work.ArtistProfile.Handle,
                    ProfileUrl: uw.Work.ArtistProfile.ProfileUrl,
                    AvatarUrl: uw.Work.ArtistProfile.AvatarUrl,
                    Status: db.UserArtists
                        .Where(ua => ua.UserId == currentUser.UserId && ua.ArtistId == uw.Work.ArtistProfile.ArtistId)
                        .Select(ua => (ArtistStatus?)ua.Status)
                        .FirstOrDefault())))
            .ToListAsync(ct);

        return Results.Ok(new Page<WorkDto>(page, pageSize, totalCount, items));
    }
}
