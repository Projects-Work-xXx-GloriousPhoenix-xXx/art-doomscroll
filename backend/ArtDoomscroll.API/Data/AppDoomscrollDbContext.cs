using ArtDoomscroll.API.Entities;
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

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<ArtistProfile>().HasIndex(p => new { p.Platform, p.ExternalId }).IsUnique();
        b.Entity<Work>().HasIndex(w => new { w.Platform, w.ExternalId }).IsUnique();

        b.Entity<UserArtist>().HasKey(x => new { x.UserId, x.ArtistId });
        b.Entity<UserWork>().HasKey(x => new { x.UserId, x.WorkId });
    }
}
