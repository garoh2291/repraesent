import { type RefObject, useEffect } from "react";

type RefType<T> = RefObject<T> | Array<RefObject<T>>;

export const useOutsideClickHandler = <T>(
  refs: RefType<T>,
  onOutsideClick: CallableFunction,
  whitelist?: Array<string>
) => {
  useEffect(() => {
    function handleClickOutside(event: any) {
      const refsArray = Array.isArray(refs) ? refs : [refs];

      const isClickedInsideRefs = refsArray.some(
        (ref) => ref.current && (ref.current as any).contains(event.target)
      );

      const isClickedOnWhitelisted = whitelist?.includes(event.target?.id);

      if (!isClickedInsideRefs && !isClickedOnWhitelisted) {
        onOutsideClick();
      }
    }

    window?.addEventListener("mousedown", handleClickOutside);
    return () => {
      window?.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onOutsideClick, refs, whitelist]);
};
