using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;
using Microsoft.EntityFrameworkCore;

namespace ArtDoomscroll.API.Features.Me;

public static class GetMe
{
    public record Response(Guid Id, string DisplayName, string Email, string? AvatarUrl, DateTime CreatedAt);
    public static void Map(IEndpointRouteBuilder app) => app.MapGet("/me", Handle);
    private static async Task<IResult> Handle(AppDoomscrollDbContext db, ICurrentUser currentUser, CancellationToken ct)
    {
        var me = await db.Users
            .Where(u => u.Id == currentUser.UserId)
            .Select(u => new Response(u.Id, u.DisplayName, u.Email, u.AvatarUrl, u.CreatedAt))
            .FirstOrDefaultAsync(ct);

        return me is null
            ? Results.Unauthorized()
            : Results.Ok(me);
    }
}
