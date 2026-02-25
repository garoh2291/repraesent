
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { TooltipPortal } from "@radix-ui/react-tooltip";
import { Copy, Check } from "lucide-react";
import React, { useState, useCallback, useMemo, useRef } from "react";

type TooltipSide = "top" | "bottom" | "left" | "right";

interface TooltipContainerProps {
  children: React.ReactNode;
  tooltipContent: React.ReactNode;
  side?: TooltipSide;
  classname?: string;
  disableTooltip?: boolean;
  showCopyButton?: boolean;
  copyText?: string;
  onCopySuccess?: (copiedText: string) => void;
  onCopyError?: (error: Error) => void;
  copyButtonClassName?: string;
  delayDuration?: number;
}

const extractTextFromElement = (element: React.ReactNode): string => {
  if (typeof element === "string") return element;
  if (typeof element === "number") return String(element);
  if (
    typeof element === "boolean" ||
    element === null ||
    element === undefined
  ) {
    return "";
  }

  if (Array.isArray(element)) {
    return element.map(extractTextFromElement).join("");
  }

  if (React.isValidElement(element)) {
    const { children } = element.props as React.PropsWithChildren<any>;
    if (children) {
      return extractTextFromElement(children);
    }
  }

  return String(element);
};

const TooltipContainer = React.memo<TooltipContainerProps>(
  ({
    children,
    tooltipContent,
    side = "top",
    classname = "",
    disableTooltip = false,
    showCopyButton = true,
    copyText,
    onCopySuccess,
    onCopyError,
    copyButtonClassName = "",
    delayDuration = 300,
  }) => {
    const [copied, setCopied] = useState<boolean>(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const textToCopy = useMemo((): string => {
      if (copyText) return copyText;

      if (typeof tooltipContent === "string") {
        return tooltipContent;
      }

      return extractTextFromElement(tooltipContent);
    }, [copyText, tooltipContent]);

    const handleCopy = useCallback(
      async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        try {
          if (!textToCopy.trim()) {
            throw new Error("No content to copy");
          }

          await navigator.clipboard.writeText(textToCopy);
          setCopied(true);
          onCopySuccess?.(textToCopy);

          timeoutRef.current = setTimeout(() => {
            setCopied(false);
            timeoutRef.current = null;
          }, 2000);
        } catch (err) {
          const error =
            err instanceof Error ? err : new Error("Failed to copy text");
          console.error("Copy failed:", error);
          onCopyError?.(error);
        }
      },
      [textToCopy, onCopySuccess, onCopyError]
    );

    React.useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    const buttonTitle = useMemo(
      () => (copied ? "Copied!" : "Copy content"),
      [copied]
    );

    const buttonClassNames = useMemo(
      () =>
        cn(
          "flex-shrink-0 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150 self-start focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
          copyButtonClassName
        ),
      [copyButtonClassName]
    );

    const tooltipContentClassName = useMemo(
      () => cn("max-w-[600px] whitespace-pre-line relative", classname),
      [classname]
    );

    return (
      <TooltipProvider delayDuration={delayDuration}>
        <Tooltip>
          <TooltipTrigger asChild>{children}</TooltipTrigger>
          {!disableTooltip && (
            <TooltipPortal>
              <TooltipContent side={side} className={tooltipContentClassName}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">{tooltipContent}</div>

                  {showCopyButton && (
                    <button
                      onClick={handleCopy}
                      className={buttonClassNames}
                      title={buttonTitle}
                      type="button"
                      aria-label={buttonTitle}
                      disabled={!textToCopy.trim()}
                    >
                      {copied ? (
                        <Check
                          size={10}
                          className="text-green-600 dark:text-green-400"
                          aria-hidden="true"
                        />
                      ) : (
                        <Copy
                          size={10}
                          className="text-white dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  )}
                </div>
              </TooltipContent>
            </TooltipPortal>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  }
);

TooltipContainer.displayName = "TooltipContainer";

export default TooltipContainer;
