using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;
using ArtDoomscroll.API.Errors;
using ArtDoomscroll.API.Features.Artists;
using ArtDoomscroll.API.Features.Authentication;
using ArtDoomscroll.API.Features.Library;
using ArtDoomscroll.API.Features.Me;
using ArtDoomscroll.API.Features.Works;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using System.Text;
using System.Text.Json.Serialization;
using ArtDoomscroll.API.Features.Images;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer();

builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtOptions>>((o, jwtOptions) =>
    {
        var jwt = jwtOptions.Value;
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
            ClockSkew = TimeSpan.FromSeconds(30),
        };
    });

builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build());

builder.Services.AddDbContext<AppDoomscrollDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddHttpClient(GetImage.ClientName, client =>
{
    client.Timeout = TimeSpan.FromSeconds(10);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("art-doomscroll/1.0");
})
.ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler { AllowAutoRedirect = false });

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();

builder.Services.AddControllers();
builder.Services.AddOpenApi(options =>
{
    options.CreateSchemaReferenceId = typeInfo =>
        typeInfo.Type.IsNested
            ? $"{typeInfo.Type.DeclaringType!.Name}{typeInfo.Type.Name}"
            : OpenApiOptions.CreateDefaultSchemaReferenceId(typeInfo);
});

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<BadRequestExceptionHandler>();

builder.Services.AddOptions<JwtOptions>()
    .Bind(builder.Configuration.GetSection(JwtOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddOptions<GoogleOptions>()
    .Bind(builder.Configuration.GetSection(GoogleOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<TokenService>();

var app = builder.Build();

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
    app.MapScalarApiReference().AllowAnonymous();
    AuthDev.Map(app);
    await DevDataSeeder.SeedAsync(app.Services);
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

AddArtist.Map(app);
UpdateArtistStatus.Map(app);
UpdateArtistNote.Map(app);
ListArtists.Map(app);
GetArtist.Map(app);
DeleteArtist.Map(app);

AddWork.Map(app);
UpdateWorkStatus.Map(app);
ListWorks.Map(app);
GetWork.Map(app);
LookupWork.Map(app);
DeleteWork.Map(app);

LookupLibrary.Map(app);

AuthGoogle.Map(app);
RefreshSession.Map(app);
Logout.Map(app);

GetMe.Map(app);
GetMyStats.Map(app);

GetImage.Map(app);

app.Run();
