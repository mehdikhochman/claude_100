"use client";
import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type AuthFormState } from "../actions";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";

const initialState: AuthFormState = {};

export function LoginForm({ returnUrl }: { returnUrl: string }) {
  const [state, action] = useActionState(loginAction, initialState);
  const errors = state.errors ?? {};
  const values = state.values ?? {};

  return (
    <form action={action} className="form" noValidate>
      <input type="hidden" name="returnUrl" value={values.returnUrl ?? returnUrl} />

      {errors.form ? (
        <div className="form__error" role="alert">
          {errors.form}
        </div>
      ) : null}

      <Field id="identifier" label="Email or phone number" error={errors.identifier}>
        {(a11y) => (
          <input
            {...a11y}
            name="identifier"
            className="input"
            type="text"
            autoComplete="username"
            defaultValue={values.identifier ?? ""}
            required
          />
        )}
      </Field>

      <Field id="password" label="Password" error={errors.password}>
        {(a11y) => (
          <input {...a11y} name="password" className="input" type="password" autoComplete="current-password" required />
        )}
      </Field>

      <div className="form__actions">
        <SubmitButton className="btn btn--block" pendingLabel="Signing in…">
          Log in
        </SubmitButton>
      </div>

      <p className="form__foot">
        New here? <Link href="/register">Create an account</Link>
      </p>
    </form>
  );
}
