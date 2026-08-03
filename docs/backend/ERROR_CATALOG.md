# Backend Error Catalogue

All service and future Edge Function errors use a stable code. Mobile screens
show the safe message and use `retryable` to decide whether a retry action is
appropriate. Provider messages, SQL details, stack traces, tokens, and internal
IDs are never displayed.

| Code | User meaning | Retryable by default | Typical source |
| --- | --- | --- | --- |
| `VALIDATION_FAILED` | Submitted fields are invalid. | No | PostgreSQL checks, parser validation, request schema. |
| `AUTHENTICATION_REQUIRED` | Session is missing or expired. | No; restore identity first | Supabase Auth/PostgREST 401. |
| `PERMISSION_DENIED` | The signed-in user cannot access the record. | No | RLS or explicit authorization. |
| `RESOURCE_NOT_FOUND` | The record no longer exists. | No | Empty `.single()` result or hidden foreign record. |
| `CONFLICT` | A duplicate or newer version prevents the change. | No; refresh first | Unique constraint or revision mismatch. |
| `RATE_LIMITED` | The caller has exceeded a safety limit. | Yes, after delay | Edge Function/provider 429. |
| `NETWORK_UNAVAILABLE` | Backend could not be reached. | Yes | Fetch failure or timeout. |
| `BACKEND_NOT_READY` | Required schema is not installed in this environment. | No | PostgreSQL `42P01` or PostgREST `PGRST205`. |
| `TRANSACTION_READ_FAILED` | Transaction retrieval failed. | Yes via explicit action | Unknown transaction query failure. |
| `TRANSACTION_WRITE_FAILED` | Transaction mutation failed and is not confirmed. | Yes when operation remains queued | Unknown transaction write failure. |
| `GOAL_READ_FAILED` | Goal retrieval failed. | Yes via explicit action | Unknown goal query failure. |
| `GOAL_WRITE_FAILED` | Goal mutation failed and is not confirmed. | Yes via explicit action | Unknown goal write failure. |
| `INTERNAL_ERROR` | An unexpected trusted-service error occurred. | Yes once | Unclassified Edge Function/service failure. |

## Standard result envelope

Success:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "request_id": "req_01J...",
    "timestamp": "2026-08-03T12:00:00.000Z"
  }
}
```

Failure:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Check the highlighted information and try again.",
    "retryable": false,
    "field_errors": [
      { "field": "amount", "code": "POSITIVE_REQUIRED", "message": "Enter an amount above zero." }
    ]
  },
  "meta": {
    "request_id": "req_01J...",
    "timestamp": "2026-08-03T12:00:00.000Z"
  }
}
```

Direct PostgREST services throw `BackendError` with the same code/message
contract. Edge Functions return the serialized envelope with the correct HTTP
status.
