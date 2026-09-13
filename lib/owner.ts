/**
 * The site owner's account, by id rather than pseudo so a rename keeps access.
 * Used to open games that are still under construction to the owner only.
 */
export const OWNER_USER_ID = '080a255a-12df-4307-a660-f5e8dfe74468';

export function isOwner(userId: string | null | undefined): boolean {
  return userId === OWNER_USER_ID;
}
