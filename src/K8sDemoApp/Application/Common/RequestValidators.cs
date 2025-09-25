namespace K8sDemoApp.Application.Common;

internal static class RequestValidators
{
    public static bool TryGetDurationInMinutes(double minutes, double max, out TimeSpan duration, out string error)
    {
        if (double.IsNaN(minutes) || double.IsInfinity(minutes) || minutes <= 0)
        {
            duration = TimeSpan.Zero;
            error = "Minutes must be greater than zero.";
            return false;
        }

        if (minutes > max)
        {
            duration = TimeSpan.Zero;
            error = $"Minutes cannot exceed {max}.";
            return false;
        }

        duration = TimeSpan.FromMinutes(minutes);
        error = string.Empty;
        return true;
    }

    public static bool TryGetThreadCount(int? requested, out int threads, out string error)
    {
        threads = requested ?? Math.Clamp(Environment.ProcessorCount, 1, Environment.ProcessorCount * 2);
        if (threads <= 0)
        {
            error = "Threads must be greater than zero.";
            return false;
        }

        var max = Environment.ProcessorCount * 8;
        if (threads > max)
        {
            error = $"Threads cannot exceed {max}.";
            return false;
        }

        error = string.Empty;
        return true;
    }

    public static bool TryGetMemoryTarget(int requested, int maxMegabytes, out int target, out string error)
    {
        if (requested <= 0)
        {
            target = 0;
            error = "Target megabytes must be greater than zero.";
            return false;
        }

        if (requested > maxMegabytes)
        {
            target = 0;
            error = $"Target megabytes is capped at {maxMegabytes}.";
            return false;
        }

        target = requested;
        error = string.Empty;
        return true;
    }
}
