"use client";
import Link from "next/link";
import { useActionState } from "react";
import { createSessionAction, updateSessionAction, type AdminFormState } from "../actions";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";

type ClassOption = { id: string; name: string; isArchived: boolean };
type SessionValues = { id?: string; classId: string; coachName: string; startsAt: string; capacity: number | string; bookedCount?: number };

export function SessionForm({ classes, initial, timezone }: { classes: ClassOption[]; initial?: SessionValues; timezone: string }) {
  const action = initial?.id ? updateSessionAction : createSessionAction;
  const [state, formAction] = useActionState(action, {} as AdminFormState);
  const errors = state.errors ?? {};
  const v = { ...initial, ...state.values } as Partial<SessionValues> & Record<string, string | number | undefined>;

  return (
    <form action={formAction} className="form" noValidate>
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      {errors.form ? (
        <div className="form__error" role="alert">
          {errors.form}
        </div>
      ) : null}

      <Field id="classId" label="Class" error={errors.classId}>
        {(a11y) => (
          <select {...a11y} name="classId" className="select" defaultValue={v.classId ?? ""} required>
            <option value="" disabled>
              Choose a class…
            </option>
            {classes.map((c) => (
              <option key={c.id} value={c.id} disabled={c.isArchived && c.id !== initial?.classId}>
                {c.name}
                {c.isArchived ? " (archived)" : ""}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field id="coachName" label="Coach" error={errors.coachName}>
        {(a11y) => <input {...a11y} name="coachName" className="input" defaultValue={v.coachName ?? ""} required />}
      </Field>

      <div className="grid grid--2">
        <Field id="startsAt" label="Starts at" hint={`Studio time (${timezone}).`} error={errors.startsAt}>
          {(a11y) => (
            <input {...a11y} name="startsAt" className="input" type="datetime-local" step={300} defaultValue={v.startsAt ?? ""} required />
          )}
        </Field>
        <Field
          id="capacity"
          label="Capacity"
          hint={initial?.bookedCount ? `${initial.bookedCount} already confirmed.` : undefined}
          error={errors.capacity}
        >
          {(a11y) => (
            <input {...a11y} name="capacity" className="input" type="number" min={1} max={200} inputMode="numeric" defaultValue={v.capacity ?? 12} required />
          )}
        </Field>
      </div>

      <div className="form__actions">
        <SubmitButton pendingLabel="Saving…">{initial?.id ? "Save changes" : "Create session"}</SubmitButton>
        <Link href="/admin/sessions" className="btn btn--ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}
