# Antybłędy z poprzednich iteracji

## Błąd krytyczny 1
Codex mieszał trzy różne role repo:
- repo wiedzy,
- repo pośredniego prototypu,
- repo docelowego runtime.

### Twarda poprawka
- Czytaj 1.0 i 2.0 tylko referencyjnie.
- Koduj WYŁĄCZNIE w 3.0.
- Nie kopiuj folderów pomocniczych z 1.0/2.0 do 3.0.

---

## Błąd krytyczny 2
Codex zaczął traktować prototyp z 2.0 jako literalny finalny UI.

### Twarda poprawka
- `prototype-ui/index.html` służy tylko do:
  - IA,
  - nazewnictwa modułów,
  - tonu interfejsu,
  - relacji między ekranami.
- Nie wolno odtwarzać go piksel w piksel jako produktu końcowego.
- Nie wolno zostawiać atrap modułów jako „gotowe”.

---

## Błąd krytyczny 3
Codex wchodził w pętlę „ładnego mockupu”, a nie realnej architektury.

### Twarda poprawka
Najpierw trzeba ustalić i wdrożyć:
- nowy plugin runtime `zegger-erp/`,
- bootstrap,
- aktywację,
- nowe nazewnictwo,
- nowy shell,
- bezpieczne osadzenie / integrację legacy Offer Panel,
- dopiero potem dopieszczać moduły.

---

## Błąd krytyczny 4
Codex próbował budować fałszywy nowy Panel Ofertowy zamiast zachować istniejący dojrzały moduł.

### Twarda poprawka
- Legacy Offer Panel jest aktywem, nie przeszkodą.
- Nie wolno robić „fake replacement”.
- Nie wolno rozmontować logiki ofert, PDF, historii, klientów.
- Integracja z ERP ma być nadrzędna, ale moduł ofertowy ma zachować rozpoznawalny charakter i realną funkcjonalność.

---

## Błąd krytyczny 5
Codex traktował kalkulator jako nadal główny host aplikacji.

### Twarda poprawka
- Kalkulator ma być launcherem wejścia.
- Finalna sesja i finalny runtime mają żyć w ERP.
- Koniec z ciężkim modalem-hostem jako modelem docelowym.

---

## Błąd krytyczny 6
Codex robił zmiany, których nie było widać albo które nie miały odbicia w realnym flow.

### Twarda poprawka
Każdy etap musi kończyć się raportem:
- jakie pliki zmieniono,
- po co,
- jak to wpływa na runtime,
- co da się realnie zobaczyć po wdrożeniu,
- czy zmieniono aktywację / DB / routing / assets.

---

## Błąd krytyczny 7
Codex mógł ponownie wygenerować chaos repo:
- duplikaty folderów pluginu,
- preview kopie,
- błędne ZIP root,
- przypadkowe foldery pomocnicze w finalnym repo.

### Twarda poprawka
W 3.0 ma istnieć tylko jedna kanoniczna ścieżka nowego pluginu runtime.
Jeżeli powstają artefakty pomocnicze, muszą być jawnie nazwane i nie mogą mylić instalatora WP.

---

## Błąd krytyczny 8
Codex mógł znów zbudować generyczny enterprise dashboard.

### Twarda poprawka
System ERP ma być:
- kompaktowy,
- zadaniowy,
- szybki,
- bez korpo-dashboardowego balastu,
- bez wielkiej ciężkiej lewostronnej nawigacji jako motywu dominującego,
- z sensownym mobile, projektowanym osobno.

---

## Błąd krytyczny 9
Codex mógł zignorować fakt, że obecne screeny z ostatniej iteracji nie są finalnym targetem, tylko częściowo trafionym kierunkiem.

### Twarda poprawka
Screeny z tej rozmowy należy traktować jako:
- referencję rytmu,
- referencję kompaktowości,
- referencję tonu i modułowego shell-a,
- NIE jako bezwzględny literalny final design.

Ogólna stylistyka jest dobra.
Pętla złych decyzji i „syf” mają zostać odcięte.
