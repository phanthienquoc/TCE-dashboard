# SSI portfolio sync

TCE portfolio sync discovers SSI accounts, but equity portfolio synchronization only snapshots Cash and Margin accounts. SSI may also return derivative accounts from `getAccountInfo()`; those accounts are excluded from equity balance/position calls because the equity portfolio endpoints reject derivative account numbers.
