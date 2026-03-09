# Audyt repo 1.0 / 2.0 / 3.0

## 1. Repo 1.0 - `KarolPluska/Zegger`

### Rola
Repo 1.0 NIE jest bazą do dalszego rozwijania runtime.
To jest repo wiedzy referencyjnej, z którego trzeba wyciągnąć:
- legacy plugin,
- kalkulator,
- oryginalny pakiet specyfikacji dla Codex,
- założenia migracji i acceptance.

### Co tam realnie jest
- folder `codex_zegger_erp_materials/`
- folder `zq-offer-suite/`
- folder `zegger-erp/`
- folder `Plugin ZIP/`
- plik `AGENTS.md`
- plik `Źródło - Kalkulator ogrodzeń ZEGGER v1.9.9.1.html`

### Wniosek
Repo 1.0 należy traktować jako:
- źródło wymagań,
- źródło wiedzy o legacy,
- anty-przykład dla kontynuowania starego runtime bez uporządkowania.

Nie wolno przenosić 1:1 całej architektury 1.0 do 3.0.

---

## 2. Repo 2.0 - `KarolPluska/SystemERP-2.0`

### Rola
Repo 2.0 NIE jest bazą runtime do dalszego developmentu.
To jest iteracja pośrednia z ważnymi ostrzeżeniami organizacyjnymi, ale błędnym dryfem wizualnym i prototypowym.

### Co tam realnie jest
- folder `prototype-ui/`
- folder `zq-offer-suite-v1.2.18.7/`
- folder `SystemERP-2.0_codex_materials/`
- plik `AGENTS.md`
- plik `Źródło - Kalkulator ogrodzeń ZEGGER v1.9.9.1.html`

### Co jest wartościowe
- `AGENTS.md` - bardzo trafne guardraile dot. aktywacji, struktury repo, braku duplikatów, braku BOM, premium app-window UX, mobile osobno
- `prototype-ui/index.html` - przydatne WYŁĄCZNIE jako szkic:
  - architektury informacji,
  - nazw modułów,
  - tonu copy,
  - idei kompaktowego shell-a,
  - rozdzielenia auth / launcher / moduły

### Czego NIE wolno z niego kopiować 1:1
- literalnego wyglądu całego prototypu,
- pustych kart z tekstami udającymi gotowe moduły,
- atrap danych jako finalnego UI,
- błędnej tendencji do budowania „ładnego placeholder ERP” zamiast realnego systemu,
- zbyt sztywnego, martwego layoutu, który wygląda jak demo zamiast narzędzia pracy.

### Wniosek
Repo 2.0 ma być użyte do wydobycia:
- dobrych zasad procesu,
- IA i kierunku shell-a,
- informacji, czego NIE robić drugi raz.

Nie wolno traktować 2.0 jako warstwy do „podrasowania”.

---

## 3. Repo 3.0 - `KarolPluska/SystemERP-3.0`

### Rola
To jest JEDYNE repo wdrożeniowe dla nowej próby.

### Co tam realnie jest
- folder `zq-offer-suite-v1.2.18.7/`
- plik `README.md`
- plik `Źródło - Kalkulator ogrodzeń ZEGGER v1.9.9.1.html`

### Dokładna struktura legacy pluginu w 3.0
- `zq-offer-suite-v1.2.18.7/assets/`
- `zq-offer-suite-v1.2.18.7/includes/`
- `zq-offer-suite-v1.2.18.7/zq-offer-suite.php`

### Dokładna struktura `includes/`
- `class-zqos-admin.php`
- `class-zqos-auth.php`
- `class-zqos-db.php`
- `class-zqos-maintenance.php`
- `class-zqos-panel.php`
- `class-zqos-reminders.php`
- `class-zqos-rest.php`
- `class-zqos-sheets.php`

### Wniosek
Repo 3.0 jest naprawdę czystą bazą tylko w tym sensie, że:
- nie ma jeszcze nowego shell-a ERP,
- nie ma paczki speców z 1.0,
- nie ma prototypu 2.0,
- ma tylko realny legacy plugin + kalkulator.

To oznacza, że instrukcja dla Codex MUSI jawnie rozróżniać:
- co jest źródłem wiedzy (1.0 / 2.0),
- co jest jedynym miejscem implementacji (3.0).
