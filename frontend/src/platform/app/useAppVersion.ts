import { useEffect, useState } from "preact/hooks";
import { getAppVersion } from "../pywebview/app.api";

let cachedVersion: string | null = null;
let pendingVersionRequest: Promise<string | null> | null = null;

async function resolveAppVersion(): Promise<string | null> {
  if (cachedVersion) {
    return cachedVersion;
  }

  if (!pendingVersionRequest) {
    pendingVersionRequest = getAppVersion()
      .then((response) => {
        if (!response.ok) {
          return null;
        }

        const resolved = response.data?.version ?? response.version ?? null;
        if (resolved) {
          cachedVersion = resolved;
        }

        return resolved;
      })
      .catch(() => null)
      .finally(() => {
        pendingVersionRequest = null;
      });
  }

  return pendingVersionRequest;
}

export function useAppVersion() {
  const [version, setVersion] = useState<string | null>(cachedVersion);

  useEffect(() => {
    let isMounted = true;

    void resolveAppVersion().then((resolved) => {
      if (!isMounted || !resolved) return;
      setVersion(resolved);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return version;
}
