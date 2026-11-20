using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;
using Microsoft.EntityFrameworkCore;

namespace ArtDoomscroll.API.Features;

public static class DeleteArtist
{
    public static void Map(IEndpointRouteBuilder app) => app.MapDelete("/artists/{id:guid}", Handle);
    private static async Task<IResult> Handle(Guid id, AppDoomscrollDbContext db, ICurrentUser currentUser, CancellationToken ct)
    {
        var userArtist = await db.UserArtists
            .Where(ua => ua.UserId == currentUser.UserId && ua.ArtistId == id)
            .FirstOrDefaultAsync(ct);

        if (userArtist is null)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Artist not found",
                detail: $"Artist with id '{id}' was not found in your library."
            );
        }

        db.UserArtists.Remove(userArtist);
        await db.SaveChangesAsync(ct);

        return Results.NoContent();
    }
}
