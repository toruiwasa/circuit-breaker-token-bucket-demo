"use client";
import { Toast } from "radix-ui";

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant: "error" | "warn";
}

interface Props {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function Toaster({ toasts, onDismiss }: Props) {
  return (
    <Toast.Provider swipeDirection="right" duration={4000}>
      {toasts.map((t) => (
        <Toast.Root
          key={t.id}
          open
          onOpenChange={(open) => {
            if (!open) onDismiss(t.id);
          }}
          className={`relative flex flex-col gap-1 rounded-lg border px-4 py-3 shadow-xl
            transition-all duration-300
            data-[state=open]:opacity-100 data-[state=open]:translate-y-0
            data-[state=closed]:opacity-0 data-[state=closed]:-translate-y-2
            data-[swipe=end]:translate-x-full data-[swipe=move]:translate-x-[--radix-toast-swipe-move-x]
            ${
              t.variant === "warn"
                ? "border-amber-400/30 bg-zinc-900 text-amber-300"
                : "border-orange-500/30 bg-zinc-900 text-orange-300"
            }`}
        >
          <Toast.Title className="pr-6 text-sm font-semibold">
            {t.title}
          </Toast.Title>
          {t.description && (
            <Toast.Description className="text-xs opacity-70">
              {t.description}
            </Toast.Description>
          )}
          <Toast.Close className="absolute right-3 top-3 text-sm opacity-50 hover:opacity-100">
            ✕
          </Toast.Close>
        </Toast.Root>
      ))}
      <Toast.Viewport className="fixed top-4 right-4 z-50 flex w-80 flex-col gap-2 outline-none" />
    </Toast.Provider>
  );
}
