Zaliczka - change to zasilenie konta współpracownika

Transactions labeling - change to transfers everywhere for better clarity (transfery)

We need to add cash register -> cash register transaction

Debug -> caclulating saldo -> Juri dostał kase ale nie zmieniło się jego saldo

Settlement resets form - check all forms if this is happening

Verify logic and cash flow

When we create wydatek pracowniczy it should subtract this amount from worker account
But not from cash register account - i think this is happening ? This part needs a full re-think and verification
If we are using ziuteks money no need to choose cash register ?

Money added to any cash only by another transaction from kasa główna or somewhere
Money can be added to kasa główna only by transaction.
I need to rethink if editing should be possible at all even from payload admin.
To add money to cash register like kasa glówna we need more types of transactions

- zasilenie od inwestora if selected invesatment select appears and we are updating saldo of selected investment
  this also needs a rethink
  maybe adding expenses to investment should actually create a negative saldo and adding zaliczka from investora zasilenie type should add money to investment ?

Kasa pomocnicza mogą widzieć menagerowie
Kasa główna ma być widoczna tylko szef.

We need to add another filter type inside transactions table and verify if there is a column investment in tables
Filtrowanie po inwestycji
Kolumna inwestya

Użytkownik nie po trzebuje kasy - zawsze wydatki schodza z jego konta

Settlement:
You can add expense without selected investment or invoice you can add it later anyway
Can you add investment later ? // to consider
Hmm typ of expense here ?

Zaliczka - POWINNA NAZYWAĆ SIĘ ZASILENIE KONTA

New transaction / expense
Transakcja na poczet wynagrodzenia

Investment view

Also select with typ of transaction
