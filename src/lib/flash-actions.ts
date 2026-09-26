"use server";
import { clearFlash } from "./flash";

/** Called by <FlashMessage> once it has been displayed. */
export async function clearFlashAction(): Promise<void> {
  await clearFlash();
}
