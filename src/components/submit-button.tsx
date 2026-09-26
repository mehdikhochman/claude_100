"use client";
// Submit button that shows a pending label while the Server Action runs.
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  name?: string;
  value?: string;
  disabled?: boolean;
};

export function SubmitButton({
  children,
  pendingLabel = "Please wait…",
  className = "btn",
  formAction,
  name,
  value,
  disabled,
}: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending || disabled}
      aria-disabled={pending || disabled}
      formAction={formAction}
      name={name}
      value={value}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
