using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;
using Microsoft.EntityFrameworkCore;

namespace ArtDoomscroll.API.Features.Artists;

public static class UpdateArtistNote
{
    public record Request(string? Note);
    public record Response(string? Note);
    public static void Map(IEndpointRouteBuilder app) => app.MapPatch("/artists/{artistId:guid}/note", Handle);
    private static async Task<IResult> Handle(Guid artistId, Request req, AppDoomscrollDbContext db, ICurrentUser currentUser, CancellationToken ct)
    {
        var note = string.IsNullOrWhiteSpace(req.Note) ? null : req.Note.Trim();
        var validationErrors = new Dictionary<string, string[]>();
        if (note?.Length > 1024)
        {
            validationErrors.Add("note", ["Note cannot exceed 1024 characters."]);
        }
        if (validationErrors.Count != 0)
        {
            return Results.ValidationProblem(validationErrors);
        }

        var userArtist = await db.UserArtists
            .FirstOrDefaultAsync(ua => ua.ArtistId == artistId && ua.UserId == currentUser.UserId, ct);

        if (userArtist is null)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Artist not found",
                detail: $"Artist with id '{artistId}' was not found in your library."
            );
        }

        userArtist.Note = note;
        userArtist.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        var response = new Response(userArtist.Note);
        return Results.Ok(response);
    }
}
