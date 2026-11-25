// "I picked Agent/Rider at sign-in but my account is a customer": remember that
// across the move into the signed-in app so we can open the apply form there.
let applyFor: 'agent' | 'rider' | null = null;

export const setApplyIntent = (role: 'agent' | 'rider') => {
  applyFor = role;
};

/** Returns the pending intent once, then clears it. */
export function takeApplyIntent(): 'agent' | 'rider' | null {
  const r = applyFor;
  applyFor = null;
  return r;
}
