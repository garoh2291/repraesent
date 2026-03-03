import { useEffect, useState } from "react";

export const useDebounce = <T>(data: T, delay: number) => {
  const [debounceText, setDebounceText] = useState<T>(data);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebounceText(data);
    }, delay);

    return () => clearInterval(handler);
  }, [delay, data]);

  return debounceText;
};
