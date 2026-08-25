import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AUTH_SESSION_INVALID_EVENT,
  AUTH_TOKEN_ROTATED_EVENT,
} from "./authToken";

export const FINANCIAL_READ_SCOPE = "financial:read";
export const ADMIN_MANAGEMENT_SCOPE = "admin:manage";

const MAX_STEP_UP_LIFETIME_SECONDS = 5 * 60;

export const isFinancialStepUpError = (error) => {
  const status = error?.response?.status;
  return status === 401 || status === 403;
};

const useFinancialStepUp = () => {
  const [grant, setGrant] = useState(null);

  const lock = useCallback(() => {
    setGrant(null);
  }, []);

  const unlock = useCallback((token, expiresIn) => {
    const lifetimeSeconds = Number(expiresIn);
    if (
      typeof token !== "string" ||
      !token ||
      !Number.isFinite(lifetimeSeconds) ||
      lifetimeSeconds <= 0
    ) {
      return false;
    }

    setGrant({
      token,
      expiresAt:
        Date.now() +
        Math.min(lifetimeSeconds, MAX_STEP_UP_LIFETIME_SECONDS) * 1000,
    });
    return true;
  }, []);

  useEffect(() => {
    if (!grant) return undefined;

    const remainingMilliseconds = grant.expiresAt - Date.now();
    const timeoutId = window.setTimeout(
      lock,
      Math.max(0, remainingMilliseconds),
    );
    return () => window.clearTimeout(timeoutId);
  }, [grant, lock]);

  useEffect(() => {
    window.addEventListener(AUTH_SESSION_INVALID_EVENT, lock);
    window.addEventListener(AUTH_TOKEN_ROTATED_EVENT, lock);
    return () => {
      window.removeEventListener(AUTH_SESSION_INVALID_EVENT, lock);
      window.removeEventListener(AUTH_TOKEN_ROTATED_EVENT, lock);
    };
  }, [lock]);

  const requestHeaders = useMemo(
    () =>
      grant
        ? {
            "X-Step-Up-Token": grant.token,
          }
        : {},
    [grant],
  );

  return {
    isUnlocked: Boolean(grant),
    lock,
    requestHeaders,
    stepUpToken: grant?.token || null,
    unlock,
  };
};

export default useFinancialStepUp;
