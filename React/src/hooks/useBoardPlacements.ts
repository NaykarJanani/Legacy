import { useCallback, useEffect, useState } from "react";
import api from "../services/api";

export interface BoardPlacementRow {
  id: number;
  user_id: number;
  board_type: string;
  position_id: string;
  gallery_id: number;
  placed_by_editor_id?: number | null;
  crop_zoom?: number | null;
  crop_pos_x?: number | null;
  crop_pos_y?: number | null;
  file_url: string;
  view_url: string;
  updated_at?: string;
}

/**
 * Fetches assigned images for one board (vision_board / achievement /
 * generation_web / legacy_timeline) and returns a `position_id -> view_url`
 * lookup map, so a page can do `placements["3"]` to get the assigned image
 * (falling back to its own default asset when nothing's assigned yet).
 *
 * - Editor pages: pass `customerId` (from location.state, set by
 *   Editorcardinnerpage's handleToolClick) — calls
 *   GET /editor/customer/:user_id/board-placements?board_type=...
 * - School/user pages: omit `customerId` — backend uses the logged-in
 *   user's own id — calls GET /user/board-placements?board_type=...
 *
 * Also returns `refetch`, so a caller can re-pull placements right after
 * saving a new one (e.g. after a crop/adjust upload finishes) instead of
 * waiting for the next full mount.
 */
export function useBoardPlacements(boardType: string, customerId?: number | string) {
  const [placements, setPlacements] = useState<Record<string, string>>({});
  // Full row per position (gallery_id, crop_zoom, crop_pos_x, crop_pos_y, ...) —
  // editor pages use this to reuse an already-placed image's gallery_id when
  // the editor is only re-adjusting pan/zoom, instead of uploading a new file.
  const [placementDetails, setPlacementDetails] = useState<Record<string, BoardPlacementRow>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchPlacements = useCallback(async () => {
    // Editor pages need a customerId to know whose project this is. If this
    // page was opened without navigating from the project card (no state),
    // skip the fetch rather than hitting a path with "undefined" in it.
    const isEditorPath =
      typeof window !== "undefined" && window.location.pathname.startsWith("/editor/");
    if (isEditorPath && customerId === undefined) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const url = customerId !== undefined
        ? `/customer/${customerId}/board-placements`
        : `/board-placements`;

      const res = await api.get(url, { params: { board_type: boardType } });
      const rows: BoardPlacementRow[] = res.data?.data ?? [];

      const map: Record<string, string> = {};
      const details: Record<string, BoardPlacementRow> = {};
      rows.forEach((row) => {
        map[row.position_id] = row.view_url;
        details[row.position_id] = row;
      });
      setPlacements(map);
      setPlacementDetails(details);
    } catch (err) {
      console.error(`Failed to load ${boardType} placements`, err);
    } finally {
      setIsLoading(false);
    }
  }, [boardType, customerId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Reuse fetchPlacements but respect the cancelled flag for this
      // particular effect run, same as the original implementation.
      const isEditorPath =
        typeof window !== "undefined" && window.location.pathname.startsWith("/editor/");
      if (isEditorPath && customerId === undefined) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const url = customerId !== undefined
          ? `/customer/${customerId}/board-placements`
          : `/board-placements`;

        const res = await api.get(url, { params: { board_type: boardType } });
        const rows: BoardPlacementRow[] = res.data?.data ?? [];

        if (cancelled) return;

        const map: Record<string, string> = {};
        const details: Record<string, BoardPlacementRow> = {};
        rows.forEach((row) => {
          map[row.position_id] = row.view_url;
          details[row.position_id] = row;
        });
        setPlacements(map);
        setPlacementDetails(details);
      } catch (err) {
        console.error(`Failed to load ${boardType} placements`, err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardType, customerId]);

  return { placements, placementDetails, isLoading, refetch: fetchPlacements };
}