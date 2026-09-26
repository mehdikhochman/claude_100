import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getScoreForUser } from "@/lib/score";
import { avatarStorageAvailable, AVATAR_MAX_BYTES } from "@/lib/avatar";
import { AvatarImage } from "@/components/avatar-image";
import { ScoreCard } from "@/components/score-card";
import { SubmitButton } from "@/components/submit-button";
import { NameForm } from "./name-form";
import { removeAvatarAction, setPrivacyAction, uploadAvatarAction } from "./actions";
import { formatDayLong } from "@/lib/time";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const score = await getScoreForUser(user.id);
  const uploadsEnabled = avatarStorageAvailable();

  return (
    <div className="container container--medium">
      <div className="page-head">
        <span className="eyebrow">Your profile</span>
        <h1>{user.name}</h1>
        <p className="lede">
          Member since {formatDayLong(user.createdAt)}. <Link href={`/profile/${user.id}`}>View your public profile →</Link>
        </p>
      </div>

      <div className="grid grid--3" style={{ alignItems: "start" }}>
        <div className="stack" style={{ gridColumn: "span 2" }}>
          <section className="card" aria-labelledby="photo-title">
            <span className="eyebrow">Photo</span>
            <h2 id="photo-title" style={{ fontSize: "1.6rem" }}>
              Your picture
            </h2>
            <div className="profile-head">
              <AvatarImage userId={user.id} name={user.name} size="xl" />
              <div className="stack" style={{ flex: 1 }}>
                <form action={uploadAvatarAction} className="form">
                  <div className="field">
                    <label className="field__label" htmlFor="photo">
                      Choose a new photo
                    </label>
                    <input
                      id="photo"
                      name="photo"
                      type="file"
                      className="input"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      required
                      disabled={!uploadsEnabled}
                      aria-describedby="photo-hint"
                      style={{ paddingTop: "10px" }}
                    />
                    <span id="photo-hint" className="field__hint">
                      JPEG, PNG, WebP or GIF · up to {Math.round(AVATAR_MAX_BYTES / 1024 / 1024)}MB. We resize it to a
                      square and serve it only to logged-in members.
                    </span>
                  </div>
                  {uploadsEnabled ? (
                    <div className="row">
                      <SubmitButton className="btn btn--secondary" pendingLabel="Uploading…">
                        Upload photo
                      </SubmitButton>
                      {user.avatarUrl ? (
                        <SubmitButton className="btn btn--ghost" formAction={removeAvatarAction} pendingLabel="Removing…">
                          Remove photo
                        </SubmitButton>
                      ) : null}
                    </div>
                  ) : (
                    <p className="small muted mb-0">Photo uploads are not configured on this deployment yet.</p>
                  )}
                </form>
              </div>
            </div>
          </section>

          <section className="card" aria-labelledby="name-title">
            <span className="eyebrow">Details</span>
            <h2 id="name-title" style={{ fontSize: "1.6rem" }}>
              Name
            </h2>
            <NameForm currentName={user.name} />
            <hr className="hairline" style={{ marginBlock: "24px" }} />
            <dl className="small">
              <dt className="muted">Email</dt>
              <dd style={{ margin: "0 0 12px" }}>{user.email}</dd>
              <dt className="muted">Phone</dt>
              <dd style={{ margin: 0 }}>{user.phone ?? "—"}</dd>
            </dl>
          </section>

          <section className="card" aria-labelledby="privacy-title">
            <span className="eyebrow">Privacy</span>
            <h2 id="privacy-title" style={{ fontSize: "1.6rem" }}>
              {user.isPublic ? "Your profile is public" : "Your profile is private"}
            </h2>
            <p className="small muted">
              Public: other members can see your photo and details on your profile page. Private: only your LEGACY
              score is shown. Your score is always public.
            </p>
            <form action={setPrivacyAction}>
              <input type="hidden" name="isPublic" value={user.isPublic ? "false" : "true"} />
              <SubmitButton className="btn btn--ghost" pendingLabel="Saving…">
                {user.isPublic ? "Make my profile private" : "Make my profile public"}
              </SubmitButton>
            </form>
          </section>
        </div>

        <ScoreCard score={score} forest />
      </div>
    </div>
  );
}
