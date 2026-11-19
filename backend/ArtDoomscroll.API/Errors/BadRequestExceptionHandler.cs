using Microsoft.AspNetCore.Diagnostics;
using System.Text.Json;

namespace ArtDoomscroll.API.Errors;

public sealed class BadRequestExceptionHandler(IProblemDetailsService problemDetailsService) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        if (exception is not BadHttpRequestException badRequest)
            return false;

        var field = (badRequest.InnerException as JsonException)?.Path?.TrimStart('$', '.');

        var problem = string.IsNullOrEmpty(field)
            ? new HttpValidationProblemDetails { Title = "Invalid request body" }
            : new HttpValidationProblemDetails(new Dictionary<string, string[]>
            {
                [field] = ["Invalid value"]
            });

        problem.Status = badRequest.StatusCode;
        context.Response.StatusCode = badRequest.StatusCode;

        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            ProblemDetails = problem,
            Exception = exception
        });
    }
}

