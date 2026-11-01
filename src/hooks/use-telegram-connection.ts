import { UI_PREVIEW_ENABLED } from "@/config/runtime";
import {
  createPreviewTelegramLinkCode,
  disconnectPreviewTelegram,
  getPreviewTelegramConnection,
  simulatePreviewTelegramLink,
} from "@/fixtures/preview-channels";
import { useAuth } from "@/hooks/use-auth";
import {
  createTelegramLinkCode,
  disconnectTelegram,
  getTelegramConnection,
} from "@/services/supabase/channel-service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const channelKeys = {
  all: ["channels"] as const,
  telegram: (userId: string) => [...channelKeys.all, "telegram", userId] as const,
};

/**
 * @param pollWhileLinking Re-check the connection every few seconds while a
 * link code is on screen, so the panel flips to "connected" as soon as the
 * user finishes in Telegram.
 */
export function useTelegramConnection({
  pollWhileLinking = false,
}: { pollWhileLinking?: boolean } = {}) {
  const { user } = useAuth();
  const userId = user?.uid ?? "";
  const queryClient = useQueryClient();
  const key = channelKeys.telegram(userId);

  const connection = useQuery({
    enabled: UI_PREVIEW_ENABLED || !!userId,
    queryFn: () =>
      UI_PREVIEW_ENABLED
        ? getPreviewTelegramConnection()
        : getTelegramConnection(userId),
    queryKey: key,
    refetchInterval: pollWhileLinking ? 3000 : false,
    staleTime: 1000 * 30,
  });

  const createLinkCode = useMutation({
    mutationFn: () =>
      UI_PREVIEW_ENABLED
        ? createPreviewTelegramLinkCode()
        : createTelegramLinkCode(),
  });

  const disconnect = useMutation({
    mutationFn: async (connectionId: string) => {
      if (UI_PREVIEW_ENABLED) return disconnectPreviewTelegram();
      return disconnectTelegram(connectionId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const simulateLink = useMutation({
    mutationFn: simulatePreviewTelegramLink,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return { connection, createLinkCode, disconnect, simulateLink };
}
