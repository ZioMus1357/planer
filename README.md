# Dayflow

Prosty, lokalny planer dnia z kalendarzem i szablonami zadań. Dane są zapisywane w `localStorage` przeglądarki.

## Uruchomienie

```bash
npm install
npm run dev
```

Następnie otwórz adres pokazany w terminalu (domyślnie `http://127.0.0.1:5173`).

## Wersja produkcyjna

```bash
npm run build
```

Folder `dist` można opublikować na GitHub Pages lub Cloudflare Pages. Dla obu usług polecenie budowania to `npm run build`, a katalog wyjściowy to `dist`.

## Synchronizacja Firebase

Aplikacja jest gotowa do synchronizacji między urządzeniami przez Firebase Authentication i Cloud Firestore. Bez konfiguracji Firebase dalej działa lokalnie, wykorzystując `localStorage`.

1. Otwórz [Firebase Console](https://console.firebase.google.com/) i utwórz projekt.
2. Dodaj do niego aplikację internetową (ikona `</>`). Skopiuj wartości konfiguracji Firebase.
3. W **Authentication → Sign-in method** włącz metodę **Email/Password** oraz dostawcę **Google**. Przy Google wybierz swój adres jako kontaktowy e-mail pomocy.
4. W **Firestore Database** utwórz bazę w trybie produkcyjnym.
5. W zakładce **Rules** wklej reguły z pliku `firestore.rules` i opublikuj je.
6. Skopiuj `.env.example` jako `.env.local` i uzupełnij cztery wartości konfiguracji, dokładnie z obiektu `firebaseConfig` widocznego po rejestracji aplikacji internetowej.
7. Uruchom ponownie aplikację. Pojawi się ekran zakładania konta lub logowania.

Po publikacji na GitHub Pages dodaj domenę `twoj-login.github.io` w **Authentication → Settings → Authorized domains**. Dodaj też `localhost`, jeśli chcesz testować logowanie lokalnie.

Każde konto zapisuje dane osobno w prywatnym dokumencie Firestore. Po pierwszym logowaniu obecne dane z `localStorage` zostaną przesłane do chmury tylko wtedy, gdy konto nie ma jeszcze planera.

`.env.local` nie powinien trafiać do repozytorium. Konfiguracja Firebase identyfikuje projekt, natomiast prywatność danych zapewniają reguły Firestore — dlatego nie zastępuj ich regułami otwartego dostępu.
