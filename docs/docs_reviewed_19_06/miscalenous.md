##

- Czy sumy per-typ (Materiały budowlane/wykończeniowe) mają mieć też wariant „rozliczone"?

## 16. LEKCJA (to całe back-and-forth — czego nie powtarzać)

1. **Ta sama figura składana niezależnie w wielu miejscach nie może być równa „przez przypadek".** Równość musi być wymuszonym inwariantem (wspólny kod tam, gdzie się da; test właściwości tam, gdzie kod musi się różnić — jak interaktywny bilans).
2. **Test parytetu jest bezwartościowy, jeśli wykonuje kod, którego żadna strona nie używa.** Testowaliśmy `extractFigures ↔ extractFigures` → zielono, gdy ekrany różniły się o setki zł na 7 inwestycjach. Test MUSI wołać realne funkcje, które renderuje powierzchnia, na realnych danych.
3. **Różnica legalna ≠ błąd.** Bilans listingu (formuła) vs bilans detalu (suma widocznych kafelków) różnią się **z założenia** (toggle). Błędem był brak testu, że zgadzają się w stanie domyślnym.
4. **Dowód czerwienią, nie rozumowaniem.** Nigdy nie ogłaszać „zweryfikowane / nie da się zepsuć" z samego rozumowania. Tylko z wykonywalnego red→green na realnej ścieżce (nasz test był czerwony na 7 inwestycjach, zielony po fixie).
5. **Stare/realne dane to wyrocznia.** Nieskategoryzowane korekty — niemożliwe do utworzenia dziś przez formularz — ujawniły lukę. Każdy guard sprawdzać na pełnym lokalnym DB, nie tylko na syntetyku.
6. **Niedbałe liczby (np. „4–6 miejsc") to też brak weryfikacji.** Precyzyjnie: marża = 1 wzór, 3 miejsca wywołania (w tym osierocony `extractFigures`); bilans = 2 legalne algorytmy. Liczyć grepem, nie z pamięci.
