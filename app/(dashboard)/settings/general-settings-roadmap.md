# Roadmap: General Settings Implementation

This document outlines the planned features and options for the **General Settings** panel in Crenelle.

---

## 1. Organization & Branding Details
- **Organization Name**: The master brand name of the host (e.g. "Acme Corp" or "Community Tech").
- **Custom Domain / Path**: Option to customize subdomains (e.g., `crenelle.app/o/orgname`) or link custom root domains for public registration and event landing pages.
- **Brand Identity**: Primary and secondary accent color pickers along with default banner and logo uploads. These skin new event forms, ticket PDFs, and invitation layouts automatically.

---

## 2. Localization & Regional Defaults
- **Default Timezone**: The timezone for starting ticket sales, closing registrations, and scheduled mail merges.
- **Default Currency**: The currency for paid ticket tiers (e.g. USD, EUR, NGN, GBP).
- **Format Preferences**: Date notation (e.g. `YYYY-MM-DD` vs `DD/MM/YYYY`) and clock style (12-hour vs 24-hour) globally enforced on guest interfaces.

---

## 3. Global Notification Preferences
- **Organizer Digests**: Set up automated daily or weekly summaries showing event registrations, scanner check-in rates, and financial reports.
- **Global Email Footer**: Custom HTML or plain text footer (e.g., mailing address, legal terms, or tax IDs) appended automatically to all guest notifications.

---

## 4. Integrations & Webhooks (Developer Tools)
- **API Access Keys**: Create, list, and revoke programmatic API tokens for external sync scripts and check-in scanner clients.
- **Webhooks**: Define URL endpoints to receive HTTP payloads on trigger events (e.g., `registration.created`, `ticket.scanned`) to integrate with Slack, Discord, Zapier, or CRM tools.
