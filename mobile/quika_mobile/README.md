# Qyka mobile (Expo)

React Native app for customers, agents, riders and shopkeepers. **UI only:**
there is no backend, network, storage, camera or payment code. Every screen
renders static sample data from `src/lib/mock.ts`, and actions only change
local screen state. Admin and the investor view stay on the web.

## Run it

`npm install`, then `npx expo start --clear`, and open it in Expo Go or a
development build.

## Sign-in

Pick a role, enter anything, and "Verify" opens that role's sample account.
Nothing is checked or saved.

## Layout

- `src/app/(app)/{customer,agent,rider,shopkeeper}`: one tab group per role.
- `src/components/ui.tsx`: shared pieces, styled with NativeWind from the web's Tailwind tokens (`tailwind.config.js`).
- `src/components/chat`: order chat and inbox, shared by customer and agent.
- `src/lib/types.ts`: the data shapes the screens render.
- `src/lib/mock.ts`: the static sample data.
