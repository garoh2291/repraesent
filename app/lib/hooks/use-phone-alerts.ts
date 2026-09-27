import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuthContext } from "~/providers/auth-provider";
import {
  getPhoneAlertDevices,
  getPhoneAlertPreferences,
  getPhoneAlertsConfig,
  phoneAlertsKeys,
} from "~/lib/api/phone-alerts";
import { getThisDeviceSubscription } from "~/lib/pwa/use-pwa";

/** Is the feature on at all? An unreachable endpoint counts as "not yet". */
export function usePhoneAlertsConfig() {
  const { user } = useAuthContext();
  return useQuery({
    queryKey: phoneAlertsKeys.config(),
    queryFn: getPhoneAlertsConfig,
    enabled: !!user,
    retry: false,
    staleTime: 30 * 60_000,
  });
}

export function usePhoneAlertPreferences(enabled = true) {
  const { user } = useAuthContext();
  return useQuery({
    queryKey: phoneAlertsKeys.preferences(user?.id),
    queryFn: getPhoneAlertPreferences,
    enabled: enabled && !!user,
  });
}

export function usePhoneAlertDevices(enabled = true) {
  const { user } = useAuthContext();
  return useQuery({
    queryKey: phoneAlertsKeys.devices(user?.id),
    queryFn: getPhoneAlertDevices,
    enabled: enabled && !!user,
  });
}

/**
 * This device's push endpoint (undefined while checking, null when there is
 * none). `recheck()` after subscribing or unsubscribing.
 */
export function useThisDeviceEndpoint() {
  const [endpoint, setEndpoint] = useState<string | null | undefined>(undefined);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    void getThisDeviceSubscription().then((sub) => {
      if (alive) setEndpoint(sub?.endpoint ?? null);
    });
    return () => {
      alive = false;
    };
  }, [tick]);
  return { endpoint, recheck: () => setTick((n) => n + 1) };
}
