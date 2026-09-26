// A template (unlike a layout) re-renders on every navigation, so it is the
// right place to read the one-shot flash cookie set by Server Actions.
import { FlashMessage } from "@/components/flash-message";
import { readFlash } from "@/lib/flash";

export default async function RootTemplate({ children }: { children: React.ReactNode }) {
  const flash = await readFlash();
  return (
    <>
      <div className="container">
        <FlashMessage flash={flash} />
      </div>
      {children}
    </>
  );
}
