namespace ArtDoomscroll.API.Shared;

public record Page<T>(int PageNumber, int PageSize, int TotalCount, List<T> Items)
{
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
    public bool HasPrevious => PageNumber > 1;
    public bool HasNext => PageNumber < TotalPages;
}
