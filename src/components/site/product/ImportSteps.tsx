import { Check, FileSpreadsheet } from "lucide-react";
import styles from "./ImportSteps.module.css";

/* A DOM illustration of the import: rows from a file flow into review cards,
   then the import is approved. Sample records only. ProductMotion scrubs it
   through the data attributes; without motion it is a finished diagram. */

const ROWS = [
  { type: "client", name: "Aster House" },
  { type: "project", name: "Brand system" },
  { type: "invoice", name: "Invoice 0001" },
  { type: "expense", name: "Studio rent" },
] as const;

const REVIEW = [
  { tag: "Client", name: "Aster House", note: "New client", state: "ok" },
  { tag: "Project", name: "Brand system", note: "Linked to Aster House", state: "ok" },
  { tag: "Invoice", name: "Invoice 0001", note: "Linked to Brand system", state: "ok" },
  { tag: "Expense", name: "Studio rent", note: "Check this row", state: "warn" },
] as const;

const APPROVE = ["Clients", "Projects", "Invoices", "Expenses"] as const;

const FILES = [
  { name: "clients.csv", kind: "CSV" },
  { name: "projects.csv", kind: "CSV" },
  { name: "invoices.xlsx", kind: "XLSX" },
] as const;

export function ImportSteps({ focus }: { focus: "flow" | "upload" }) {
  if (focus === "upload") {
    return (
      <div className={styles.root} role="img" aria-label="Sample files being uploaded for import" data-import="upload">
        <div className={styles.scale} aria-hidden="true">
          <div className={`${styles.step} ${styles.upload}`}>
            <header className={styles.head}>
              <span className={styles.num}>1</span>
              <span className={styles.stepName}>Upload</span>
            </header>
            <ul className={styles.files}>
              {FILES.map((file) => (
                <li key={file.name} className={styles.file} data-file>
                  <FileSpreadsheet className={styles.fileIcon} />
                  <span className={styles.fileName}>{file.name}</span>
                  <span className={styles.badge}>{file.kind}</span>
                  <span className={styles.bar}>
                    <span className={styles.barFill} data-file-fill />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root} role="img" aria-label="Sample rows flowing from an uploaded file into review cards, then approved" data-import="flow">
      <div className={styles.scale} aria-hidden="true">
        <div className={styles.grid} data-grid>
          <div className={styles.step} data-step="upload">
            <header className={styles.head}>
              <span className={styles.num}>1</span>
              <span className={styles.stepName}>Upload</span>
            </header>
            <div className={styles.sheet}>
              <div className={styles.sheetName}>
                <FileSpreadsheet className={styles.fileIcon} />
                <span>records.csv</span>
              </div>
              {ROWS.map((row) => (
                <div key={row.name} className={styles.row} data-row>
                  <span className={styles.rowType}>{row.type}</span>
                  <span className={styles.rowName}>{row.name}</span>
                </div>
              ))}
            </div>
          </div>

          <span className={styles.conn} data-conn />

          <div className={styles.step} data-step="review">
            <header className={styles.head}>
              <span className={styles.num}>2</span>
              <span className={styles.stepName}>Review</span>
            </header>
            <div className={styles.cards}>
              {REVIEW.map((card) => (
                <div key={card.name} className={styles.card} data-state={card.state} data-rcard>
                  <span className={styles.cardTag}>{card.tag}</span>
                  <span className={styles.cardName}>{card.name}</span>
                  <span className={styles.cardNote}>{card.note}</span>
                </div>
              ))}
            </div>
          </div>

          <span className={styles.conn} data-conn />

          <div className={styles.step} data-step="approve">
            <header className={styles.head}>
              <span className={styles.num}>3</span>
              <span className={styles.stepName}>Approve</span>
            </header>
            <ul className={styles.checks}>
              {APPROVE.map((label) => (
                <li key={label} className={styles.check} data-check>
                  <span className={styles.tick}>
                    <Check strokeWidth={3} />
                  </span>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
            <span className={styles.approve} data-approve>
              Approve import
            </span>
          </div>

          {ROWS.map((row) => (
            <span key={row.name} className={styles.packet} data-packet />
          ))}
        </div>
      </div>
    </div>
  );
}
