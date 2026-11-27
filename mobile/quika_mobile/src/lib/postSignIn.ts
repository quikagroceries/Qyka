// What someone picked on Welcome ("I shop the market" / "I deliver orders") survives sign-in here, so a brand-new account
// lands on that registration form instead of the customer home. Cleared once the home screen has used it.
let apply: 'agent' | 'rider' | null = null;

export const postSignIn = {
  set: (role: 'agent' | 'rider' | null) => {
    apply = role;
  },
  peek: () => apply,
  clear: () => {
    apply = null;
  },
};
