using ArtDoomscroll.API.Entities;
using ArtDoomscroll.API.Enums;
using Microsoft.EntityFrameworkCore;

namespace ArtDoomscroll.API.Data;

public class AppDoomscrollDbContext(DbContextOptions<AppDoomscrollDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Artist> Artists => Set<Artist>();
    public DbSet<ArtistProfile> ArtistProfiles => Set<ArtistProfile>();
    public DbSet<Work> Works => Set<Work>();
    public DbSet<UserArtist> UserArtists => Set<UserArtist>();
    public DbSet<UserWork> UserWorks => Set<UserWork>();
    public DbSet<UserLogin> UserLogins => Set<UserLogin>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<ArtistProfile>().HasIndex(p => new { p.Platform, p.ExternalId }).IsUnique();
        b.Entity<Work>().HasIndex(w => new { w.Platform, w.ExternalId }).IsUnique();

        b.Entity<UserArtist>().HasKey(x => new { x.UserId, x.ArtistId });
        b.Entity<UserWork>().HasKey(x => new { x.UserId, x.WorkId });

        b.Entity<UserLogin>().HasIndex(x => new { x.Provider, x.ProviderKey }).IsUnique();
        b.Entity<RefreshToken>().HasIndex(x => x.TokenHash).IsUnique();
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<Platform>().HaveConversion<string>().HaveMaxLength(32);
        configurationBuilder.Properties<ArtistStatus>().HaveConversion<string>().HaveMaxLength(32);
        configurationBuilder.Properties<WorkStatus>().HaveConversion<string>().HaveMaxLength(32);
    }
}
