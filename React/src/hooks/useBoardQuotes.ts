import { useEffect, useState } from "react";
import api from "../services/api";

export interface BoardQuoteRow {
  id: number;
  user_id: number;
  board_type: string;
  position_id: string;
  quote: string;
  updated_by_editor_id?: number | null;
  updated_at?: string;
}

/**
 * Fetches saved quote text for one board and returns a `position_id -> quote`
 * lookup map (mirrors useBoardPlacements). Also returns a `saveQuote`
 * function for editor pages to persist a new quote for one position.
 *
 * - Editor pages: pass `customerId` — reads/writes
 *   /editor/customer/:user_id/board-quote(s).
 * - School/user pages: omit `customerId` — read-only,
 *   GET /user/board-quotes (saveQuote is a no-op there; nothing calls it).
 */
export function useBoardQuotes(boardType: string, customerId?: number | string) {
  const [quotes, setQuotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const isEditorPath =
    typeof window !== "undefined" && window.location.pathname.startsWith("/editor/");

  useEffect(() => {
    if (isEditorPath && customerId === undefined) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setIsLoading(true);
        const url = customerId !== undefined
          ? `/customer/${customerId}/board-quotes`
          : `/board-quotes`;

        const res = await api.get(url, { params: { board_type: boardType } });
        const rows: BoardQuoteRow[] = res.data?.data ?? [];

        if (cancelled) return;

        const map: Record<string, string> = {};
        rows.forEach((row) => {
          map[row.position_id] = row.quote ?? "";
        });
        setQuotes(map);
      } catch (err) {
        console.error(`Failed to load ${boardType} quotes`, err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardType, customerId]);

  // Editor-only: saves one position's quote, then updates local state so the
  // UI reflects it immediately without waiting for a refetch.
  const saveQuote = async (positionId: string, quote: string) => {
    if (customerId === undefined) return; // no-op on the user side
    await api.put(`/customer/${customerId}/board-quote`, {
      board_type: boardType,
      position_id: positionId,
      quote,
    });
    setQuotes((prev) => ({ ...prev, [positionId]: quote }));
  };

  return { quotes, isLoading, saveQuote };
}