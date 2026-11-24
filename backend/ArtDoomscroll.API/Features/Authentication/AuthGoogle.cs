using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;
using ArtDoomscroll.API.Entities;
using Google.Apis.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ArtDoomscroll.API.Features.Authentication;

public static class AuthGoogle
{
    public record Request(string IdToken);
    public record Response(string AccessToken, DateTime AccessTokenExpiresAt, string RefreshToken);
    public static void Map(IEndpointRouteBuilder app) => app.MapPost("/auth/google", Handle).AllowAnonymous();
    private static async Task<IResult> Handle(Request req, AppDoomscrollDbContext db, TokenService tokens, IOptions<GoogleOptions> google, CancellationToken ct)
    {
        var validationErrors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(req.IdToken))
        {
            validationErrors.Add("idToken", ["Required field"]);
        }
        if (validationErrors.Count != 0)
        {
            return Results.ValidationProblem(validationErrors);
        }

        GoogleJsonWebSignature.Payload payload;
        try
        {
            payload = await GoogleJsonWebSignature.ValidateAsync(req.IdToken,
                new GoogleJsonWebSignature.ValidationSettings { Audience = google.Value.ClientIds });
        }
        catch (InvalidJwtException)
        {
            return Results.Unauthorized();
        }
        
        var (sub, email, name, picture) = (payload.Subject, payload.Email, payload.Name, payload.Picture);

        var userLogin = await db.UserLogins
            .Include(ul => ul.User)
            .Where(ul => ul.Provider == "Google" && ul.ProviderKey == sub)
            .FirstOrDefaultAsync(ct);

        User user;
        if (userLogin is null)
        {
            var login = new UserLogin
            {
                Provider = "Google",
                ProviderKey = sub
            };

            user = new User
            {
                DisplayName = name ?? email,
                Email = email,
                AvatarUrl = picture,
                Logins = [login]
            };

            db.Users.Add(user);
        }
        else
        {
            user = userLogin.User;
            user.DisplayName = name ?? email;
            user.Email = email;
            user.AvatarUrl = picture;
        }

        var issued = tokens.Issue(user.Id);
        await db.SaveChangesAsync(ct);

        return Results.Ok(new Response(issued.AccessToken, issued.AccessTokenExpiresAt, issued.RefreshToken));
    }
}
