import { useEffect } from "react";
import { useSearchParams } from "react-router";

/**
 * Opens a page's create dialog when the URL carries `?new=1` (⌘K "New …"
 * actions), then drops the param so a refresh does not reopen it. `value`
 * lets one page tell kinds apart (Today: `?new=lead` from the app shortcut).
 */
export function useOpenFromParam(open: () => void, param = "new", value = "1") {
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get(param) !== value) return;
    open();
    const next = new URLSearchParams(searchParams);
    next.delete(param);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
}
