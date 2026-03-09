# Checklista odbioru v2

## Repo i struktura
- [ ] Implementacja powstała wyłącznie w repo 3.0
- [ ] Nie wylądowały w repo 3.0 śmieci z 1.0/2.0
- [ ] Jest jeden kanoniczny folder nowego pluginu runtime
- [ ] ZIP root jest poprawny

## Architektura
- [ ] Nowy runtime nie rozwija dalej starego pluginu jako finalnej architektury
- [ ] Legacy jest traktowane jako źródło migracji i zachowywanej logiki
- [ ] ERP shell istnieje realnie, a nie jako atrapowy mockup

## UX / UI
- [ ] Shell jest kompaktowy
- [ ] Brak dashboardowego balastu
- [ ] Mobile jest dopracowany osobno
- [ ] Nie skopiowano 1:1 błędnego prototypu 2.0
- [ ] Nie ma pustych atrap modułów

## Offer Panel
- [ ] Flow ofert nie ma regresji
- [ ] Historia ofert działa
- [ ] Klienci działają
- [ ] PDF działa
- [ ] Notatki działają
- [ ] Moduł nie został osłabiony wizualnie ani logicznie

## Kalkulator
- [ ] Kalkulator nie jest już docelowym hostem ciężkiego runtime
- [ ] Kalkulator pełni rolę launcher-a

## Raportowanie
- [ ] Codex podał listę zmienionych plików
- [ ] Codex podał powód zmian
- [ ] Codex wskazał, co realnie da się zobaczyć po wdrożeniu
- [ ] Codex wskazał, czy ruszał aktywację, DB i calculator
