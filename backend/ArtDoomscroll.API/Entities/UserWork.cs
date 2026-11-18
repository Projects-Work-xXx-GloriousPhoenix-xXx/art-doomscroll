using ArtDoomscroll.API.Enums;

namespace ArtDoomscroll.API.Entities;

public class UserWork
{
    public Guid UserId { get; init; }
    public User User { get; init; } = null!;
    public Guid WorkId { get; init; }
    public Work Work { get; init; } = null!;

    public WorkStatus Status { get; set; } = WorkStatus.Queued;
    public DateTime AddedAt { get; init; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
