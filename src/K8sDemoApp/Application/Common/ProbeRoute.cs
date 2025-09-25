using System.Diagnostics;
using K8sDemoApp.Models;

namespace K8sDemoApp.Application.Common;

internal static class ProbeRoute
{
    public static bool TryParse(string? value, out ProbeType type)
    {
        if (!string.IsNullOrWhiteSpace(value))
        {
            var normalized = value.Trim().ToLowerInvariant();
            foreach (var candidate in Enum.GetValues<ProbeType>())
            {
                if (ToSegment(candidate) == normalized)
                {
                    type = candidate;
                    return true;
                }
            }
        }

        type = default;
        return false;
    }

    public static string ToSegment(ProbeType type) => type switch
    {
        ProbeType.Startup => "startup",
        ProbeType.Readiness => "readiness",
        ProbeType.Liveness => "liveness",
        _ => throw new UnreachableException(),
    };
}
