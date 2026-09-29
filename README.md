GamblePause Client Management & Assessment System

Overview

The GamblePause Client Management & Assessment System is a Firebase-backed application for client registration, assessment delivery, counselling workflows, staff administration, reporting, and assessment history.

The production architecture uses Firebase as the authoritative source of truth. The application UI may maintain temporary local state for interaction, but production data and configuration must persist to Firebase and remain consistent across refreshes, sessions, users, and devices.

Core Architecture

Firebase Authentication

Firebase Authentication is responsible for:

Staff/admin authentication

Counsellor authentication

Client authentication

Password management and password resets

Account activation/deactivation at the authentication layer

Passwords must never be stored in Firestore.

Firestore

Firestore is the authoritative source for application data and configuration.

Key collections include:

users/
clients/
assessmentResponses/
forms/
workflows/
caseNotes/
counsellorAssignments/
notifications/
auditLogs/
settings/

The exact existing schema and stable IDs should be preserved unless a change is required to fix an identified issue.

Source of Truth Rule

If information must survive:

page refresh

logout/login

another browser

another device

another authorized staff account

application restart

then that information belongs in Firebase.

Local React state may be used for:

modal state

menus

loading indicators

temporary form input

password visibility

unsaved drafts

other purely UI-related state

Production data must not depend on:

localStorage

hardcoded demo arrays

static TypeScript data

mock accounts

temporary React state

These must never override valid Firebase production data.

Client Registration

Client registration must use the authenticated Firebase user as the client's identity.

The registration flow must:

Authenticate the client through Firebase Auth.

Create or update the corresponding clients/{clientId} document.

Preserve the Firebase Auth UID in authUid.

Preserve the authenticated email.

Prevent duplicate client records for the same authenticated user.

Store consent and required registration information in Firestore.

Allow an existing authenticated client to continue to the Client Portal without unnecessarily creating another client.

The client record and Firebase Auth identity must remain linked.

Assessment System

Assessment Configuration

Assessments 1–6 must have one authoritative production configuration.

The system must not maintain separate competing definitions such as:

Client Portal assessment list

Super Admin assessment list

static TypeScript assessment list

localStorage assessment configuration

hardcoded demo assessment configuration

another duplicate Firestore configuration

All authorized areas must use the same Firestore-backed assessment configuration.

For each of Assessments 1–6, verify:

assessment name

formId

stageId

sequence/order

enabled/open status

form definition

questions

workflow timing

availability rules

client progress relationship

Use the existing stable formId and stageId values wherever they already exist.

Do not create duplicate assessment definitions simply because one interface cannot currently see an assessment.

Client Portal vs Super Admin Assessment Count

The Client Portal currently needs to remain consistent with the Super Admin configuration.

If the Client Portal shows six assessments while Super Admin shows four:

Inspect the exact six assessment definitions.

Determine where each definition is coming from.

Identify any static, localStorage, mock, or duplicate source.

Identify missing Firestore configuration.

Reconcile the application so both areas use the same authoritative configuration.

Verify all six individually.

Do not hide or fabricate assessments to make the counts match.

If one of the six cannot be verified in Firestore, report exactly which one and why.

Assessment Availability

Client assessment availability should be calculated from:

Global Firestore Assessment Configuration
+
Client-specific progress/state

Global configuration controls things such as:

enabled/disabled

open/closed

sequence

workflow timing

form configuration

Client-specific state controls things such as:

completed assessments

current stage

progress

due dates

client-specific availability

Global configuration and client progress must not be confused.

"Open All" / Assessment Controls

When a Super Admin opens, closes, enables, disables, or otherwise changes an assessment:

Write the change to Firestore.

Wait for Firebase to confirm success.

Update the UI from the persisted value.

Ensure the Client Portal reads the new configuration.

Ensure other authorized sessions see the same configuration.

"Open All" must perform real Firestore writes for all relevant assessments.

Changing a button's local state is not sufficient.

The UI must never display "Saved" or "Updated" when the Firebase write failed.

Assessment Submission

Assessment submission is stored in:

assessmentResponses/{submissionId}

Each completed assessment must create its own historical response document.

For example:

assessmentResponses/submission-1
assessmentResponses/submission-2
assessmentResponses/submission-3

A new assessment must never overwrite a previous completed assessment response.

Before writing an assessment response, data must be safe for Firestore. Values such as undefined must not be sent to Firestore.

The submission process must:

Build the assessment response.

Sanitize the response for Firestore.

Write the response document.

Wait for the write to succeed.

Only then update client progress/workflow.

Surface a real error if the write fails.

A failed assessment response write must not be reported as a successful assessment.

Assessment History

Assessment History must read from:

assessmentResponses

It must not depend on localStorage or a temporary React array.

History should be associated with the client using stable identifiers such as:

clientId

authUid

rather than display names alone.

A client with multiple completed assessments must see all corresponding historical response documents.

Example:

Assessment 1 — Completed
Assessment 2 — Completed
Assessment 3 — Completed

Previous historical submissions must remain unchanged when new assessments are completed.

Workflow Configuration

Workflow timing and sequence configuration must be stored in Firebase.

For example, if a Super Admin changes:

Follow-up Assessment 1
7 days → 5 days

then:

Firestore must contain 5 days.

The Admin UI must read 5 days.

The Client workflow must use 5 days.

Another authorized session must see 5 days.

Refreshing the application must still show 5 days.

Historical completed assessment responses should not be rewritten simply because global workflow configuration changes.

Super Admin Changes

Every authorized Super Admin production change must synchronize to Firebase.

This includes changes to:

staff accounts

counsellor accounts

analyst accounts

Super Admin accounts

client records

counsellor assignments

client status

assessment configuration

forms

questions

workflow configuration

assessment availability

notifications

settings

other production configuration

The required pattern is:

Super Admin changes value
        ↓
Write to Firebase
        ↓
Await Firebase success
        ↓
Update/reconcile UI
        ↓
Read persisted value when necessary

Never use:

Super Admin changes value
        ↓
Update React state only
        ↓
Show "Success"

If Firebase fails, show the actual error and do not present the change as successfully saved.

Staff, Counsellor and Admin Accounts

All staff accounts must use real Firebase Authentication accounts.

Firestore should contain the corresponding profile:

users/{firebaseUid}

The Firebase Auth UID and Firestore document ID must correspond.

Firestore stores profile information such as:

name

role

email/profile metadata

active status

account status

timestamps

relevant administrative information

Firebase Authentication remains responsible for:

password

authentication

password reset

account disabled state

Passwords must never be written to Firestore.

Creating Accounts

A Super Admin must be able to create:

Staff

Counsellor

Analyst / Viewer

another Super Admin

Account creation must create both:

Firebase Authentication account
+
Firestore users/{uid} profile

The operation should only be reported as successful when the required Firebase records are successfully created.

Creating another account must not sign out the current Super Admin.

If Firebase Admin SDK or privileged account management is required, it must run securely on the server side, such as through a trusted backend/Cloud Function.

Admin credentials must never be exposed in frontend code.

Deactivation

Deactivation must be a real Firebase operation.

When a Super Admin deactivates a user:

Firebase Authentication

The account must be disabled.

disabled = true

Firestore

The user's historical profile must remain.

For example:

active: false
status: "Deactivated"
deactivatedAt: ...
deactivatedBy: ...

The user record must not simply be deleted.

A deactivated account must be rejected by Firebase Authentication.

The system must not merely authenticate the user and then hide the interface.

If audit logging is implemented, record the deactivation without storing passwords.

Reactivation

Reactivation must restore the same Firebase account.

Firebase Authentication:

disabled = false

Firestore:

active: true
status: "Active"
reactivatedAt: ...
reactivatedBy: ...

The original Firebase UID must remain unchanged.

The user must not receive a new identity just because their account was reactivated.

Login Page

The staff/admin login page must not expose an account directory.

Do not display:

staff names

counsellor names

admin names

account cards

visible email lists

quick-login profiles

Select Account

Switch Profile

mock login buttons

hardcoded credentials

The login page should provide normal authentication such as:

Email / Username
Password
Sign In
Forgot Password

Authentication must use Firebase Auth.

There must be no local credential fallback.

Super Admin Security

Super Admin accounts must have individual credentials.

Do not use a shared password between Super Admins.

Do not hardcode passwords in:

React code

TypeScript

Firestore

localStorage

configuration files

audit logs

Each Super Admin must have an independent Firebase Authentication account.

Role information must be protected against unauthorized self-escalation.

A normal user must not be able to change their own Firestore role from a normal role to Super Admin.

Client Counts and Dashboard Consistency

The dashboard must use Firestore as the authoritative source for client counts.

The count displayed must be derived from the same authoritative records displayed in the client list.

Avoid situations where:

Dashboard = 4 clients
Refresh = 7 clients

unless the underlying Firestore production data actually changed.

Do not combine:

Firestore clients
+
localStorage clients
+
hardcoded demo clients

into the operational count.

Test / Demo / Verification Records

Existing test, demo, lookup, and verification records should not be automatically deleted.

Firebase is intended to preserve historical information.

Where records are clearly marked as test/demo/verification records, exclude them from operational production caseloads and production dashboard counts using their existing markers.

Examples may include existing fields or identifiers such as:

isDemo
test
verification
environment

Do not guess that an ambiguous record is test data.

If a record cannot be safely classified, preserve it and report the ambiguity.

Counsellor Caseload

Counsellor caseloads must be based on authoritative Firebase client assignments.

Use existing fields such as:

assignedCounsellorId
assignedCounsellorName

and the existing Firestore security model.

A counsellor must not see another counsellor's restricted client data merely because local state contains the record.

Dashboard and Cross-Page Synchronization

The following areas must represent the same underlying Firebase state:

Super Admin Dashboard

Client Dashboard

Client Portal

Counsellor Portal

Assessment History

Reports

Staff Management

Assessment/Form Builder

Workflow Management

Examples of unacceptable inconsistencies:

Firestore: assessment exists
History: 0 assessments

Firestore: assessment completed
Dashboard: pending

Admin: workflow = 5 days
Client: workflow = 7 days

Firestore: 6 assessments
Admin: 4 assessments

Firestore: client exists
Dashboard: client missing

Use real-time Firestore listeners where appropriate. Otherwise, re-read Firebase data when the relevant page loads or refreshes.

Data Flow Model

The intended production model is:

                    Firebase
                       │
        ┌──────────────┼──────────────┐
        │              │              │
     Auth          Firestore       Security
        │              │              │
        └──────────────┼──────────────┘
                       │
             Application Services
                       │
        ┌──────────────┼──────────────┐
        │              │              │
      Admin         Client        Counsellor
        │              │              │
        └──────────────┼──────────────┘
                       │
                 Shared UI State

Firebase is the source of truth.

The UI is a consumer of Firebase state, not a replacement for it.

Security Rules

Firestore security rules must preserve the existing role-based access model.

The following roles are relevant:

Super Admin
Counsellor
Staff
Analyst / Viewer

Client access must remain limited to the authenticated client's own data where applicable.

Counsellors must retain assignment-based access.

Super Admins retain administrative access.

Do not weaken production security rules merely to make a UI feature work.

If a rule needs changing, identify the exact operation and required authorization before changing it.

Important Historical Data Rule

Do not overwrite historical assessment submissions because global configuration changed.

Separate:

Global configuration

from:

Client progress

and:

Historical submissions

Recommended conceptual separation:

forms/
    Global form definitions

workflows/
    Global workflow/sequence configuration

clients/
    Current client state/progress

assessmentResponses/
    Immutable historical submissions

Refresh and Multi-Session Requirement

Every production change must be tested against:

Current UI.

Page refresh.

Logout/login.

Another authorized session.

Another device/browser where practical.

Direct Firestore verification.

A feature is not considered synchronized simply because the current React screen displays the new value.

End-to-End Verification Checklist

Client Registration

Firebase Auth account created.

Client document created in Firestore.

authUid matches Firebase Auth UID.

Existing client does not create duplicate record.

Dashboard sees the same client.

Initial Assessment

Assessment submission creates assessmentResponses/{submissionId}.

Response contains correct clientId.

Response is marked completed.

Submission survives refresh.

Assessment History displays it.

Dashboard reflects completion.

Client Portal reflects completion.

Additional Assessments

New assessment creates a NEW response document.

Previous response remains unchanged.

Assessment History displays both.

Client progress updates correctly.

Assessment Configuration

Assessments 1–6 are individually verified.

Each has the correct formId.

Each has the correct stageId.

Sequence/order is consistent.

Admin sees the same configuration as Client Portal.

Open/closed state is stored in Firestore.

Enable/disable state is stored in Firestore.

Workflow timing is stored in Firestore.

No static/localStorage configuration overrides Firebase.

Workflow Change

Super Admin changes a workflow value.

Firestore contains the new value.

UI displays the persisted value.

Client workflow uses the new value.

Another session sees the new value.

Refresh preserves the change.

Staff Account

Firebase Auth account created.

Firestore users/{uid} created.

UID matches.

Current Super Admin remains logged in.

No password is stored in Firestore.

Deactivation

Firebase Auth account disabled.

Firestore user retained.

Firestore status becomes Deactivated.

Deactivated user cannot log in.

Historical data remains available to authorized administrators.

Reactivation

Same Firebase UID is reused.

Firebase Auth account enabled.

Firestore status becomes Active.

User can log in again.

Dashboard

Client count comes from Firestore.

Test/demo records are handled consistently.

Assessment counts come from Firestore.

History counts match actual response documents.

Counsellor caseload matches Firebase assignments.

Refresh does not produce unexplained count changes.

Development Principles

1. Preserve Working Features

Do not redesign working client registration or assessment submission merely to implement synchronization.

Fix the data source and synchronization layer.

2. Avoid Duplicate Data Systems

Do not create another database, another assessment store, or another parallel configuration system.

Use the existing Firebase architecture.

3. Persist Before Reporting Success

The correct sequence is:

User action
→ Firebase write
→ Firebase success
→ UI update

not:

User action
→ UI update
→ Firebase write later

4. Historical Data Is Valuable

Do not delete historical client, staff, or assessment records merely to make the UI cleaner.

5. Firebase Must Be Verifiable

When debugging a synchronization issue, inspect the actual Firebase document/value rather than assuming the UI represents the database correctly.

Production Readiness Definition

The system is considered synchronized when:

Firebase Auth contains the real authenticated identities.

Firestore contains the authoritative production records.

Assessment configuration is shared across Admin and Client interfaces.

Assessments 1–6 are consistently defined.

Assessment submissions create durable historical documents.

Assessment History reads those documents.

Dashboard metrics derive from Firebase.

Staff account changes persist to Firebase.

Deactivation disables Firebase Auth.

Reactivation restores the same account.

Super Admin changes persist and propagate.

Test data does not distort operational counts.

Refresh does not lose production changes.

Multiple authorized sessions see consistent data.

Failed Firebase writes are surfaced as failures.

No production workflow depends on localStorage or mock data.

Final Rule

If Firebase says one thing and the UI says another, Firebase is the authoritative value and the UI must be fixed to reconcile with it.

The goal is one application, one production data source, and one consistent state across Admin, Client, Counsellor, Dashboard, Assessment History, and Reports.
