using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;
using Microsoft.EntityFrameworkCore;

namespace ArtDoomscroll.API.Features.Works;

public static class DeleteWork
{
    public static void Map(IEndpointRouteBuilder app) => app.MapDelete("/works/{id:guid}", Handle);
    private static async Task<IResult> Handle(Guid id, AppDoomscrollDbContext db, ICurrentUser currentUser, CancellationToken ct)
    {
        var userWork = await db.UserWorks
            .Where(uw => uw.UserId == currentUser.UserId && uw.WorkId == id)
            .FirstOrDefaultAsync(ct);
        if (userWork is null)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Work not found",
                detail: $"Work with id '{id}' was not found in your library."
            );
        }
        db.UserWorks.Remove(userWork);
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }
}
