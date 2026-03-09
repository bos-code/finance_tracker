import { useCallback, useState } from "react";

export function useAsync<T>(asyncFunction: () => Promise<T>) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      return await asyncFunction();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Unexpected error occurred";
      setError(message);
      throw caughtError;
    } finally {
      setIsLoading(false);
    }
  }, [asyncFunction]);

  return { execute, isLoading, error };
}
