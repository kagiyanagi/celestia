"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, XCircle, Info, HelpCircle, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToastType = "success" | "error" | "info" | "confirmation";

interface BaseToast {
  id: string;
  type: ToastType;
  title?: string;
  message?: string;
  /** Duration in ms before auto-dismiss. 0 = manual only. */
  duration: number;
}

interface StatusToast extends BaseToast {
  type: "success" | "error" | "info";
}

interface ConfirmationToast extends BaseToast {
  type: "confirmation";
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

type Toast = StatusToast | ConfirmationToast;

// What callers pass to toast()
export type ToastOptions =
  | {
      type: "success" | "error" | "info";
      title?: string;
      message: string;
      duration?: number;
    }
  | {
      type: "confirmation";
      title: string;
      message?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      duration?: number;
      onConfirm: () => void;
      onCancel?: () => void;
    };

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_SUCCESS_MS = 4_000;
const DEFAULT_ERROR_MS = 6_000;
const DEFAULT_INFO_MS = 4_000;
const MAX_VISIBLE = 3;

function defaultDuration(type: ToastType): number {
  if (type === "success") return DEFAULT_SUCCESS_MS;
  if (type === "error") return DEFAULT_ERROR_MS;
  if (type === "info") return DEFAULT_INFO_MS;
  return 0; // confirmation: manual dismiss only
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ToastContextValue {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const duration =
      options.duration ?? defaultDuration(options.type);

    const next: Toast =
      options.type === "confirmation"
        ? {
            id,
            type: "confirmation",
            title: options.title,
            message: options.message,
            confirmLabel: options.confirmLabel ?? "Confirm",
            cancelLabel: options.cancelLabel ?? "Cancel",
            duration,
            onConfirm: options.onConfirm,
            onCancel: options.onCancel,
          }
        : {
            id,
            type: options.type,
            title: options.title,
            message: options.message,
            duration,
          };

    setToasts((prev) => {
      // Deduplicate: skip if same type+message was added in the last second
      const isDuplicate = prev.some(
        (t) =>
          t.type === next.type &&
          t.message === next.message &&
          t.title === next.title,
      );
      if (isDuplicate) return prev;

      // Cap stack at MAX_VISIBLE (drop oldest)
      const trimmed = prev.length >= MAX_VISIBLE ? prev.slice(1) : prev;
      return [...trimmed, next];
    });

    return id;
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <ToastContainerPortal toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------

function ToastContainerPortal({
  toasts,
  dismiss,
}: {
  toasts: Toast[];
  dismiss: (id: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} dismiss={dismiss} />
      ))}
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Individual Toast
// ---------------------------------------------------------------------------

const ICON_MAP: Record<ToastType, React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  confirmation: HelpCircle,
};

function ToastItem({
  toast: t,
  dismiss,
}: {
  toast: Toast;
  dismiss: (id: string) => void;
}) {
  const [exiting, setExiting] = useState(false);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(t.duration);
  const startedAtRef = useRef<number | null>(null);

  const close = useCallback(() => {
    setExiting(true);
    // Let the exit animation finish before removing from DOM
    window.setTimeout(() => dismiss(t.id), 320);
  }, [dismiss, t.id]);

  // Auto-dismiss timer with pause-on-hover support
  useEffect(() => {
    if (t.duration === 0) return;

    function startTimer() {
      startedAtRef.current = Date.now();
      timerRef.current = setTimeout(() => {
        close();
      }, remainingRef.current);
    }

    startTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleMouseEnter() {
    if (t.duration === 0) return;
    setPaused(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (startedAtRef.current !== null) {
      remainingRef.current -= Date.now() - startedAtRef.current;
      startedAtRef.current = null;
    }
  }

  function handleMouseLeave() {
    if (t.duration === 0) return;
    setPaused(false);
    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      close();
    }, remainingRef.current);
  }

  function handleConfirm() {
    if (t.type !== "confirmation") return;
    t.onConfirm();
    close();
  }

  function handleCancel() {
    if (t.type !== "confirmation") return;
    t.onCancel?.();
    close();
  }

  const Icon = ICON_MAP[t.type];

  return (
    <div
      className={`toast toast-${t.type}${exiting ? " toast-exit" : " toast-enter"}`}
      role={t.type === "confirmation" ? "alertdialog" : "alert"}
      aria-atomic="true"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header row */}
      <div className="toast-header">
        <span className="toast-icon" aria-hidden>
          <Icon size={18} aria-hidden />
        </span>

        <div className="toast-content">
          {t.title ? <p className="toast-title">{t.title}</p> : null}
          {t.message ? <p className="toast-message">{t.message}</p> : null}
        </div>

        <button
          type="button"
          className="toast-close"
          aria-label="Dismiss notification"
          onClick={close}
        >
          <X size={14} aria-hidden />
        </button>
      </div>

      {/* Confirmation actions */}
      {t.type === "confirmation" ? (
        <div className="toast-actions">
          <button
            type="button"
            className="toast-btn toast-btn-cancel"
            onClick={handleCancel}
          >
            {(t as ConfirmationToast).cancelLabel}
          </button>
          <button
            type="button"
            className="toast-btn toast-btn-confirm"
            onClick={handleConfirm}
          >
            {(t as ConfirmationToast).confirmLabel}
          </button>
        </div>
      ) : null}

      {/* Progress bar (auto-dismiss toasts only) */}
      {t.duration > 0 ? (
        <div
          className={`toast-progress${paused ? " toast-progress-paused" : ""}`}
          style={{ "--toast-duration": `${t.duration}ms` } as React.CSSProperties}
          aria-hidden
        />
      ) : null}
    </div>
  );
}
