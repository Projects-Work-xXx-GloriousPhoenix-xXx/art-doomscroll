using ArtDoomscroll.API.Auth;
using ArtDoomscroll.API.Entities;
using Microsoft.EntityFrameworkCore;

namespace ArtDoomscroll.API.Data;

public static class DevDataSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDoomscrollDbContext>();

        if (await db.Users.AnyAsync(u => u.Id == DevCurrentUser.DevUserId))
            return;

        db.Users.Add(new User
        {
            Id = DevCurrentUser.DevUserId,
            DisplayName = "Dev User"
        });

        await db.SaveChangesAsync();
    }
}
