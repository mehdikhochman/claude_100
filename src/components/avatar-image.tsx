// Member photo, served through /avatar/[id] (login required, falls back to
// initials). Only used on logged-in pages.
type Props = { userId: string; name: string; size?: "sm" | "md" | "lg" | "xl"; className?: string };

export function AvatarImage({ userId, name, size = "md", className = "" }: Props) {
  const sizeClass = size === "md" ? "" : `avatar--${size}`;
  const px = { sm: 32, md: 44, lg: 96, xl: 140 }[size];
  const src = `/avatar/${userId}`;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- dynamic, auth-gated route
    <img
      src={src}
      alt={`${name}'s photo`}
      width={px}
      height={px}
      className={`avatar ${sizeClass} ${className}`.trim()}
      loading="lazy"
    />
  );
}
