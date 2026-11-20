using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Data;
using ArtDoomscroll.API.Errors;
using ArtDoomscroll.API.Features.Artists;
using ArtDoomscroll.API.Features.Works;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDoomscrollDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddScoped<ICurrentUser, DevCurrentUser>();

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

var app = builder.Build();

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
    await DevDataSeeder.SeedAsync(app.Services);
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

AddArtist.Map(app);
UpdateArtistStatus.Map(app);
ListArtists.Map(app);
GetArtist.Map(app);
DeleteArtist.Map(app);

AddWork.Map(app);
UpdateWorkStatus.Map(app);
ListWorks.Map(app);
DeleteWork.Map(app);

app.Run();
