"use client";
import { useActionState } from "react";
import { updateNameAction, type ProfileFormState } from "./actions";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";

export function NameForm({ currentName }: { currentName: string }) {
  const [state, action] = useActionState(updateNameAction, {} as ProfileFormState);
  return (
    <form action={action} className="form" noValidate>
      <Field id="name" label="Full name" error={state.errors?.name}>
        {(a11y) => (
          <input {...a11y} name="name" className="input" type="text" autoComplete="name" defaultValue={state.values?.name ?? currentName} required />
        )}
      </Field>
      <div className="form__actions">
        <SubmitButton className="btn btn--secondary" pendingLabel="Saving…">
          Save name
        </SubmitButton>
      </div>
    </form>
  );
}
