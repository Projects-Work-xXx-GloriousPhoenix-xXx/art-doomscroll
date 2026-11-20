using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;
using ArtDoomscroll.API.Entities;
using ArtDoomscroll.API.Enums;
using Microsoft.EntityFrameworkCore;

namespace ArtDoomscroll.API.Features.Artists;

public static class UpdateArtistStatus
{
    public record Request(ArtistStatus? Status);
    public record Response(ArtistStatus NewStatus);
    public static void Map(IEndpointRouteBuilder app) => app.MapPatch("/artists/{artistId:guid}/status", Handle);
    private static async Task<IResult> Handle(Guid artistId, Request req,
        AppDoomscrollDbContext db, ICurrentUser currentUser, CancellationToken ct)
    {
        var validationErrors = new Dictionary<string, string[]>();
        if (req.Status is null)
        {
            validationErrors.Add("status", ["Required field"]);
        }
        if (validationErrors.Count != 0)
        {
            return Results.ValidationProblem(validationErrors);
        }

        var status = req.Status!.Value;
        var userArtist = await db.UserArtists
            .FirstOrDefaultAsync(ua => ua.ArtistId == artistId && ua.UserId == currentUser.UserId, ct);

        if (userArtist is null)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Artist not found",
                detail: $"Artist with id '{artistId}' was not found in your library.");
        }

        userArtist.Status = status;
        userArtist.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        return Results.Ok(new Response(userArtist.Status));
    }
}
