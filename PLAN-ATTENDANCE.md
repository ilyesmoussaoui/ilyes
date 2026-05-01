# Attendance Overhaul — Plan

## Scope (from user spec)

### Delete member list refresh — done
Invalidate `['members']` & `['dashboard-alerts']` on delete.

### Attendance — full spec

**Check-in kiosk & flow**
- Tile click opens confirmation with two buttons: **Arrivée** / **Départ**
- Athlete/parent terminal variant: auto-validate after password entry
- Camera denied → illustrated step-by-step guide ("Autorisez l'accès à la caméra…")
- Biometric service offline → French card ("Service biométrique indisponible – veuillez procéder à l'enregistrement manuel")
- Auto check-in fails (expired / unpaid) → red card with French message

**Attendance log page**
- Columns: Date, Heure, Membre, Discipline, Méthode, **Appareil**, Statut (Arrivé/Départ), Durée, **Notes**, **Intervenant**
- Filters: preset + custom date range, Member (search), Discipline, Method, **Device**, Status
- Row actions: **View member**, Edit (admin), Delete (admin, reason required)
- **Export CSV** button
- **Edit history panel**: shows before/after values for each audit entry on the record

**Alerts engine (backend)**
- Gate check-in on: unpaid balance / expired subscription / subscription expiring < 4 days
- Duplicate check-in → "Already checked in at HH:mm — leaving?"
- **2 consecutive absences** → member flagged "at-risk" + SMS + staff task ("call parent")
- Write audit log on all state changes

**Offline behavior**
- Check-in/out works offline via local queue (exists already — wire to banner)
- Banner: "Hors ligne – les arrivées et les départs sont stockés localement et synchronisés lors de la connexion."

**Exact French error messages (all must be wired):**
- "Faible niveau de confiance de la reconnaissance faciale – veuillez réessayer ou utiliser l'enregistrement manuel."
- "Abonnement expiré – accès refusé. Contactez le personnel."
- "Solde impayé. Accès refusé. Contactez le personnel. Procéder au paiement ?" (Continuer / Annuler)
- "Hors ligne — l'arrivée est sauvegardée localement et sera synchronisée dès que vous serez en ligne."
- "Arrivée en double détectée — déjà enregistré à HHhMM."
- "Arrivée enregistrée."

---

## Execution phases

### Phase 1 — Attendance Log completion (frontend; backend already has the data)
- Add columns: Appareil, Notes, Intervenant
- Add filters: Member search (autocomplete), Device
- Preset date ranges: Aujourd'hui / Cette semaine / Ce mois / Personnalisé
- Export CSV button
- View member row action (link to `/members/:id`)
- French labels
- Edit history side panel on row click (reads audit_log)

### Phase 2 — Check-in & kiosk flow
- Presence tile → two-button confirmation (Arrivée / Départ)
- CheckInModal: gate on unpaid / expired / expiring ≤ 4 days → red card
- Duplicate check-in → prompt (offer check out)
- Camera-denied illustrated guide
- Biometric-offline card in kiosk
- Offline banner French copy

### Phase 3 — Alerts engine (backend)
- Add `at_risk` flag to `members` + migration
- `absence.service.ts`: threshold 2, flag at-risk, create staff task
- `tasks` table (or reuse notifications); staff task type "call_parent"
- Check-in gate: return 403 with error code (SUBSCRIPTION_EXPIRED / UNPAID_BALANCE / EXPIRING_SOON / DUPLICATE_CHECKIN) + metadata

---

## Acceptance

**Phase 1** — /attendance log shows Appareil/Notes/Intervenant, Member & Device filters work, Export CSV downloads, row click shows audit history.

**Phase 2** — tile click → two buttons, unpaid check-in → red French card, duplicate check-in prompts, offline banner visible when disconnected.

**Phase 3** — member with 2 missed scheduled sessions → at-risk flag + notification + staff task; check-in for expired sub returns 403 + error code.
