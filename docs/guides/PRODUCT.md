# Product guide

Open https://scheduleup.tech. Register with a name, email and a 15–128-character password/passphrase, or sign in to an existing account. Each account has its own workspace. Email is a login identifier; mailbox verification and forgotten-password recovery are not implemented.

## Connect channels

For WhatsApp, save the owner's international number in Settings, start the connection, display the pairing QR and link it through WhatsApp's Linked devices. Add permitted client numbers in Allowed clients. The connected account must match the saved number. WAHA is an unofficial QR-linked adapter.

For Telegram, save its owner number in Settings, choose Connect Telegram and scan the QR from Telegram's device-linking screen. Enter two-step verification if requested. Allow a private human conversation from the connected inbox. Telegram uses authoritative peer IDs; hidden numbers are not guessed. A Telegram number can differ from the WhatsApp number.

Disconnect a channel before changing its linked number. Removing a client preserves history, disables new ingestion/sends and pauses approved follow-ups. Contacts on different platforms remain separate conversations.

## Conversations and tasks

Conversations shows allowed client/owner text with All channels, WhatsApp and Telegram filters. New messages feed task extraction. An accepted owner commitment becomes open work; promised client inputs become waiting work. Ambiguous requests and proposed changes can require review. Open source evidence to inspect the supporting messages.

Tasks combines channels in a calendar showing today and the next three days in Asia/Colombo. Channel/status filters and source badges retain provenance. Completed/cancelled work leaves active views and remains in history. Manual task creation and editing are available. Review proposed changes before approving or rejecting them.

## Replies and follow-ups

Choose a conversation, create/edit a draft or use a template, then review the exact text before Send. Drafting does not send a message. Templates support reusable reply and business information.

A scheduled follow-up needs the exact recipient, text and future time approved against the current task revision. Inspect scheduled items in Tasks → Scheduled. New chat activity or task changes pause existing approvals. Cancel obsolete items and create a fresh approval when appropriate. Uncertain sends need inspection in WhatsApp/Telegram before retry; they are not automatically resent.

Internal reminders appear in the dashboard. Sign out from the workspace controls or Settings. Changing a password requires the current password and revokes existing sessions.

## Availability and scope

Inference failure retains work for retry; manual actions remain available. The [latest validation](../testing/VALIDATION.md) identifies a failing fallback model. WhatsApp live text and Telegram private text/captions are supported. Media analysis, group/channel/bot chats, Telegram edits/deletions, unlimited history import and cross-channel contact merging are not implemented.

The [simulated demo](DEMO.md) is public, fictional and read-only. It illustrates product behavior without accessing accounts, calling inference or sending messages.
