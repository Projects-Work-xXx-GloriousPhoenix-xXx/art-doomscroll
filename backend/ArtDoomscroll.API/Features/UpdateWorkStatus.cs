using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;
using ArtDoomscroll.API.Enums;
using Microsoft.EntityFrameworkCore;

namespace ArtDoomscroll.API.Features;

public static class UpdateWorkStatus
{
    public record Request(WorkStatus? Status);
    public record Response(WorkStatus NewStatus);
    public static void Map(IEndpointRouteBuilder app) => app.MapPatch("/works/{workId:guid}/status", Handle);
    private static async Task<IResult> Handle(Guid workId, Request req,
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
        var userWork = await db.UserWorks
            .FirstOrDefaultAsync(uw => uw.WorkId == workId && uw.UserId == currentUser.UserId, ct);

        if (userWork is null)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Work not found",
                detail: $"Work with id '{workId}' was not found in your library.");
        }

        userWork.Status = status;
        userWork.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        return Results.Ok(new Response(userWork.Status));
    }
}
