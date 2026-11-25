# Qyka mobile (Expo)

React Native app for customers, agents, riders and shopkeepers. Admin and the
investor view stay on the web.

## Run it

1. Start the backend (`../../start-backend.sh`, or `uvicorn` in `backend/`) on port 8000.
2. `npm install`, then `npx expo start --clear`.
3. Open it in Expo Go or a development build on a phone on the same Wi-Fi.

The app finds the backend by taking the host the Expo dev server runs on and
using port 8000. Set `EXPO_PUBLIC_API_URL` to point somewhere else.
The camera (hub check-in, purchase and chat photos) needs a device.

## Sign-in

Phone or email plus a one-time code. In development the backend returns the
code and the sign-in screen shows it. New accounts are customers; agents,
riders and shopkeepers get their role through approval in the web admin.

## Layout

- `src/app/(app)/{customer,agent,rider,shopkeeper}`: one tab group per role.
- `src/components/ui.tsx`: shared pieces, styled with NativeWind from the web's Tailwind tokens (`tailwind.config.js`).
- `src/components/chat`: order chat and inbox, shared by customer and agent.
- `src/lib/api.ts`: every backend call and its types.

## Not built yet

Push notifications, calls, the web's fonts, tab icons, customer wallet and
settings screens, agent earnings and history, GPS/map for the delivery address.
