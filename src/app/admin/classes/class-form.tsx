"use client";
import { useActionState } from "react";
import { createClassAction, updateClassAction, type AdminFormState } from "../actions";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import Link from "next/link";

type ClassValues = { id?: string; name: string; type: string; durationMinutes: number | string; level: string; description: string };

export function ClassForm({ initial }: { initial?: ClassValues }) {
  const action = initial?.id ? updateClassAction : createClassAction;
  const [state, formAction] = useActionState(action, {} as AdminFormState);
  const errors = state.errors ?? {};
  const v = { ...initial, ...state.values } as Partial<ClassValues> & Record<string, string | number | undefined>;

  return (
    <form action={formAction} className="form" noValidate>
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      {errors.form ? (
        <div className="form__error" role="alert">
          {errors.form}
        </div>
      ) : null}

      <Field id="name" label="Name" error={errors.name}>
        {(a11y) => <input {...a11y} name="name" className="input" defaultValue={v.name ?? ""} required />}
      </Field>
      <div className="grid grid--2">
        <Field id="type" label="Type" hint="Shown as a small label, e.g. Pilates, Run." error={errors.type}>
          {(a11y) => <input {...a11y} name="type" className="input" defaultValue={v.type ?? ""} required />}
        </Field>
        <Field id="level" label="Level" hint="Beginner, Intermediate, Advanced, All levels…" error={errors.level}>
          {(a11y) => <input {...a11y} name="level" className="input" defaultValue={v.level ?? ""} required />}
        </Field>
      </div>
      <Field id="durationMinutes" label="Duration (minutes)" error={errors.durationMinutes}>
        {(a11y) => (
          <input {...a11y} name="durationMinutes" className="input" type="number" min={10} max={240} step={5} inputMode="numeric" defaultValue={v.durationMinutes ?? 50} required />
        )}
      </Field>
      <Field id="description" label="Description" error={errors.description}>
        {(a11y) => <textarea {...a11y} name="description" className="textarea" defaultValue={v.description ?? ""} required />}
      </Field>

      <div className="form__actions">
        <SubmitButton pendingLabel="Saving…">{initial?.id ? "Save changes" : "Create class"}</SubmitButton>
        <Link href="/admin/classes" className="btn btn--ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}
