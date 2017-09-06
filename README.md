## Malco-ERPNext

Malco ERPNext Extension

#### Algobox Integration (with Dropbox)
There are two Custom Scripts in the fixtures. Each script interacts with custom app on submitting the transaction. 
The script first calls `upload_transaction_ts` to upload Invoice or Delivery Note, then waits for 10 seconds. After that system calls `get_algo_signature` to check for output in the dropbox folder. If system finds output it will get the signature and save it in a transaction.

#### License

MIT
