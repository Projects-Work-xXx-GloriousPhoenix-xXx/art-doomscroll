using ArtDoomscroll.API.Data;
using ArtDoomscroll.API.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace ArtDoomscroll.API.Auth;

public record AuthTokens(string AccessToken, DateTime AccessTokenExpiresAt, string RefreshToken);

public sealed class TokenService(IOptions<JwtOptions> options, AppDoomscrollDbContext db, TimeProvider time)
{
    private readonly JwtOptions _jwt = options.Value;
    public AuthTokens Issue(Guid userId)
    {
        var now = time.GetUtcNow().UtcDateTime;
        var accessExpiresAt = now.Add(_jwt.AccessTokenLifetime);

        var refreshToken = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = userId,
            TokenHash = Hash(refreshToken),
            ExpiresAt = now.Add(_jwt.RefreshTokenLifetime),
        });

        return new AuthTokens(CreateAccessToken(userId, now, accessExpiresAt), accessExpiresAt, refreshToken);
    }
    public static string Hash(string refreshToken) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(refreshToken)));

    private string CreateAccessToken(Guid userId, DateTime issuedAt, DateTime expiresAt)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.SigningKey));
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = _jwt.Issuer,
            Audience = _jwt.Audience,
            Subject = new ClaimsIdentity([new Claim(JwtRegisteredClaimNames.Sub, userId.ToString())]),
            Expires = expiresAt,
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256),
            IssuedAt = issuedAt,
            NotBefore = issuedAt,
        };
        return new JsonWebTokenHandler().CreateToken(descriptor);
    }
}
