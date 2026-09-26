import type { Metadata } from "next";
import { ClassForm } from "../class-form";

export const metadata: Metadata = { title: "New class · Admin" };

export default function NewClassPage() {
  return (
    <div className="container--narrow" style={{ marginInline: 0 }}>
      <div className="page-head">
        <span className="eyebrow">Classes</span>
        <h1>New class</h1>
      </div>
      <div className="card">
        <ClassForm />
      </div>
    </div>
  );
}
