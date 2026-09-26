"use client";
// A <form> that asks for confirmation before submitting its Server Action.
import type { ReactNode } from "react";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  message: string;
  className?: string;
  children: ReactNode;
};

export function ConfirmForm({ action, message, className, children }: Props) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
