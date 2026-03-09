# Twardy plan realizacji dla repo 3.0

## Zasada nadrzędna
Implementacja powstaje tylko w `SystemERP-3.0`.
Repo 1.0 i 2.0 są tylko materiałem wejściowym.

## Faza 0 - obowiązkowy audyt przed pierwszą zmianą
Przed dotknięciem kodu Codex ma przeanalizować w 3.0:
- `zq-offer-suite-v1.2.18.7/zq-offer-suite.php`
- `zq-offer-suite-v1.2.18.7/includes/class-zqos-admin.php`
- `zq-offer-suite-v1.2.18.7/includes/class-zqos-auth.php`
- `zq-offer-suite-v1.2.18.7/includes/class-zqos-db.php`
- `zq-offer-suite-v1.2.18.7/includes/class-zqos-maintenance.php`
- `zq-offer-suite-v1.2.18.7/includes/class-zqos-panel.php`
- `zq-offer-suite-v1.2.18.7/includes/class-zqos-reminders.php`
- `zq-offer-suite-v1.2.18.7/includes/class-zqos-rest.php`
- `zq-offer-suite-v1.2.18.7/includes/class-zqos-sheets.php`
- `Źródło - Kalkulator ogrodzeń ZEGGER v1.9.9.1.html`

Dopiero po tej analizie wolno zaproponować docelową mapę plików 3.0.

## Faza 1 - nowy runtime pluginu
Nie rozwijaj dalej `zq-offer-suite-v1.2.18.7` jako finalnego produktu.

Zrób nowy kanoniczny runtime pluginu:
- folder pluginu: `zegger-erp/`
- plik główny: `zegger-erp/zegger-erp.php`

Legacy ma być:
- źródłem migracji,
- źródłem kodu do adaptacji,
- źródłem zachowywanej funkcjonalności,
- ale nie finalnym kształtem architektury.

## Faza 2 - shell ERP
Najpierw zbuduj działający shell ERP:
- auth,
- routing po zalogowaniu,
- topbar,
- launcher/start,
- moduły,
- mobile nav,
- stan aplikacji,
- ochrona przed utratą niezapisanych zmian.

To nie ma być pusty mockup.
To ma być realny shell gotowy do osadzania modułów.

## Faza 3 - osadzenie legacy Offer Panel bez regresji
Najważniejsze wymaganie:
- NIE rób nowego, uproszczonego panelu ofertowego.
- NIE zostawiaj go w finalnym modelu jako osobnego ciężkiego iframe shell-a.
- NIE rozwalaj PDF, historii, klientów, notatek i logiki ofert.

Dozwolony kierunek:
- wydzielić i uporządkować CSS/JS/renderer z legacy,
- osadzić go jako moduł w nowym ERP shell-u,
- dodać integrację z topbar / komunikatorem / powiadomieniami / guardami zmian.

## Faza 4 - pozostałe moduły
Po realnym osadzeniu Offer Panel:
- Firma i Użytkownicy
- Biblioteka Produktów / źródła
- Komunikator
- Powiadomienia
- Relacje firmowe

Każdy moduł ma być realny.
Zero atrap udających gotowość.

## Faza 5 - kalkulator
Zmień model wejścia z kalkulatora:
- kalkulator nie hostuje już głównego runtime,
- kalkulator jest launcherem do ERP,
- wszelkie stare ciężkie overlay/iframe flow należy ograniczyć do roli przejściowej lub usunąć zgodnie z nową architekturą.

## Faza 6 - pakowanie i walidacja
Przed finalem obowiązkowo:
- walidacja struktury pluginu,
- walidacja ścieżek include/require,
- walidacja aktywacji,
- walidacja ZIP root,
- walidacja braku BOM,
- jawny raport zmian.
