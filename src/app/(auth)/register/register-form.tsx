"use client";
import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type AuthFormState } from "../actions";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { COUNTRIES, DEFAULT_COUNTRY_CODE, flagEmoji } from "@/lib/countries";

const initialState: AuthFormState = {};

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, initialState);
  const errors = state.errors ?? {};
  const values = state.values ?? {};

  return (
    <form action={action} className="form" noValidate>
      {errors.form ? (
        <div className="form__error" role="alert">
          {errors.form}
        </div>
      ) : null}

      <Field id="name" label="Full name" error={errors.name}>
        {(a11y) => (
          <input
            {...a11y}
            name="name"
            className="input"
            type="text"
            autoComplete="name"
            defaultValue={values.name ?? ""}
            required
          />
        )}
      </Field>

      <Field id="email" label="Email" error={errors.email}>
        {(a11y) => (
          <input
            {...a11y}
            name="email"
            className="input"
            type="email"
            autoComplete="email"
            inputMode="email"
            defaultValue={values.email ?? ""}
            required
          />
        )}
      </Field>

      <div className="field">
        <label className="field__label" htmlFor="phoneNumber">
          Phone <span className="muted">(optional)</span>
        </label>
        <div className="phone-field">
          <select
            name="countryCode"
            className="select"
            aria-label="Country code"
            defaultValue={values.countryCode ?? DEFAULT_COUNTRY_CODE}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {flagEmoji(c.code)} {c.name} ({c.dial})
              </option>
            ))}
          </select>
          <input
            id="phoneNumber"
            name="phoneNumber"
            className="input"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="07 00 00 00 00"
            defaultValue={values.phoneNumber ?? ""}
            aria-invalid={errors.phoneNumber ? true : undefined}
            aria-describedby={errors.phoneNumber ? "phoneNumber-error" : "phoneNumber-hint"}
          />
        </div>
        {errors.phoneNumber ? (
          <span id="phoneNumber-error" className="field__error" role="alert">
            {errors.phoneNumber}
          </span>
        ) : (
          <span id="phoneNumber-hint" className="field__hint">
            You can log in with your phone number too.
          </span>
        )}
      </div>

      <Field id="password" label="Password" hint="At least 6 characters." error={errors.password}>
        {(a11y) => (
          <input {...a11y} name="password" className="input" type="password" autoComplete="new-password" required />
        )}
      </Field>

      <Field id="confirmPassword" label="Confirm password" error={errors.confirmPassword}>
        {(a11y) => (
          <input
            {...a11y}
            name="confirmPassword"
            className="input"
            type="password"
            autoComplete="new-password"
            required
          />
        )}
      </Field>

      <div className="form__actions">
        <SubmitButton className="btn btn--block" pendingLabel="Creating your account…">
          Create account
        </SubmitButton>
      </div>

      <p className="form__foot">
        Already a member? <Link href="/login">Log in</Link>
      </p>
    </form>
  );
}
