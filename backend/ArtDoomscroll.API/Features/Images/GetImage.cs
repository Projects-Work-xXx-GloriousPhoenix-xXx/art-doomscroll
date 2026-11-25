namespace ArtDoomscroll.API.Features.Images;

public static class GetImage
{
    public const string ClientName = "images";

    private static readonly Dictionary<string, string?> AllowedHosts = new(StringComparer.OrdinalIgnoreCase)
    {
        ["i.pximg.net"] = "https://www.pixiv.net/",
    };

    public static void Map(IEndpointRouteBuilder app) => app.MapGet("/images", Handle).AllowAnonymous();

    private static async Task<IResult> Handle(string? url, IHttpClientFactory httpClientFactory, HttpContext http, CancellationToken ct)
    {
        var validationErrors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(url))
        {
            validationErrors.Add("url", ["Required field"]);
        }
        else if (!Uri.TryCreate(url, UriKind.Absolute, out var parsed)
            || parsed.Scheme != Uri.UriSchemeHttps
            || !parsed.IsDefaultPort
            || !AllowedHosts.ContainsKey(parsed.Host))
        {
            validationErrors.Add("url", ["Not an allowed image URL"]);
        }
        if (validationErrors.Count != 0)
        {
            return Results.ValidationProblem(validationErrors);
        }

        var uri = new Uri(url!);
        var request = new HttpRequestMessage(HttpMethod.Get, uri);
        if (AllowedHosts[uri.Host] is { } referer)
        {
            request.Headers.Referrer = new Uri(referer);
        }

        HttpResponseMessage response;
        try
        {
            response = await httpClientFactory.CreateClient(ClientName)
                .SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        }
        catch (HttpRequestException)
        {
            return Results.StatusCode(StatusCodes.Status502BadGateway);
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            return Results.StatusCode(StatusCodes.Status504GatewayTimeout);
        }

        var contentType = response.Content.Headers.ContentType?.MediaType;
        if (!response.IsSuccessStatusCode || contentType is null || !contentType.StartsWith("image/"))
        {
            var status = response.StatusCode == System.Net.HttpStatusCode.NotFound
                ? StatusCodes.Status404NotFound
                : StatusCodes.Status502BadGateway;
            response.Dispose();
            return Results.StatusCode(status);
        }

        http.Response.RegisterForDispose(response);
        http.Response.Headers.CacheControl = "public, max-age=604800, immutable";
        return Results.Stream(await response.Content.ReadAsStreamAsync(ct), contentType);
    }
}