# System ERP 3.0 - paczka instrukcji v2

Ta wersja jest poprawiona po audycie repozytoriów:
- `KarolPluska/Zegger` - źródło wiedzy, legacy, materiały specyfikacji
- `KarolPluska/SystemERP-2.0` - błędna iteracja pośrednia, ale zawiera ważne ostrzeżenia i szkic IA
- `KarolPluska/SystemERP-3.0` - jedyna baza robocza do implementacji

Cel tej paczki:
- zatrzymać pętlę błędów z 1.0 i 2.0,
- zakotwiczyć GPT-5.3-Codex w realnej strukturze repo 3.0,
- odciąć go od kopiowania złego runtime i złej warstwy wizualnej,
- wymusić ochronę legacy Panelu Ofertowego,
- rozdzielić: źródła wiedzy vs docelowe repo wdrożeniowe.

Najważniejsze pliki:
- `01_AUDYT_REPO_1_2_3.md`
- `02_ANTYBLEDY_Z_POPRZEDNICH_ITERACJI.md`
- `03_TWARDY_PLAN_REALIZACJI_DLA_REPO_3.md`
- `04_PROMPT_DLA_GPT53_CODEX_V2.txt`
- `05_CHECKLISTA_ODBIORU_V2.md`
