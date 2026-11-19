using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;
using ArtDoomscroll.API.Enums;
using Microsoft.EntityFrameworkCore;

namespace ArtDoomscroll.API.Features;

public static class UpdateArtistStatus
{
    public record Request(ArtistStatus? Status);
    public record Response(ArtistStatus NewStatus);
    public static void Map(IEndpointRouteBuilder app) => app.MapPatch("/artists/{artistId:guid}/status", Handle);
    private static async Task<IResult> Handle(Guid artistId, Request req,
        AppDoomscrollDbContext db, ICurrentUser currentUser, CancellationToken ct)
    {
        if (req.Status is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["status"] = ["Required field"]
            });
        }

        var userArtist = await db.UserArtists
            .FirstOrDefaultAsync(ua => ua.ArtistId == artistId && ua.UserId == currentUser.UserId, ct);

        if (userArtist is null)
        {
            return Results.NotFound();
        }

        userArtist.Status = req.Status.Value;
        userArtist.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        return Results.Ok(new Response(userArtist.Status));
    }
}
