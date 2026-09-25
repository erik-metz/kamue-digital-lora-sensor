# Budget source discovery — 24 September 2026

Verified discovery pages, not enabled budget adapters:

- Biblis: the [official budget listing](https://www.biblis.eu/rathaus/ortsrecht/haushaltsplan/) links the [2026 adopted plan](https://www.biblis.eu/rathaus/ortsrecht/haushaltsplan/haushaltsplan-2026-beschlussfassung-ohne-stellenplan.pdf?cid=h2v). The [official notice dated 24 April 2026](https://www.biblis.eu/rathaus/aktuelles/amtliche-bekanntmachungen/haushaltssatzung-und-bekanntmachung-der-haushaltssatzung-2026/) confirms publication and supervisory approval. Next: archive the PDF, inspect summary tables and implement page-level numeric provenance with reconciliation.
- Lampertheim: the [official finance listing](https://www.lampertheim.de/de/buergerservice/verwaltung/finanzen/index.php) labels the 2026 download **Entwurf**, while the 2025 download is labelled **Stand Beschluss zum 21.02.2025**. Do not ingest a draft as an adopted 2026 plan. Next: verify the latest adoption/amendment documents, and ingest document status separately from fiscal year.
- Bürstadt and Groß-Rohrheim: current adopted source documents have not yet been verified in this discovery pass. Search snippets and secondary reporting are insufficient to enable an adapter.

The parser must distinguish accrual revenue/expenses from cash receipts/payments, current-year authorization from multiyear forecast columns, and plan from actual. No budget values were added from search snippets.

Update: current listing now links `haushaltsplan-2026.pdf?cid=ha1`; the old indexed link returns 404. An implemented collector follows the listing and rejects inconsistent totals. See `continuation-validation.md` for the verified discrepancy and resulting review publication.
