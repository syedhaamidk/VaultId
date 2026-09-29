// examples/react.jsx — React usage with the component library.
// Install: npm i @chomuiro/saisei
// Import once at app root:  import "@chomuiro/saisei/dist/blueprint.css";
import { useState } from "react";
import {
  Button, Card, Badge, Alert, Modal, Tabs, Accordion,
  ToastProvider, useToast, TickerTape, ThemeToggle,
  DataTable, CommandPalette, Dropdown, Combobox,
  Reveal, AnimatedNumber, TiltCard, DrawOn, ScrollRule,
} from "@chomuiro/saisei/react";

function Demo() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  return (
    <main className="container">
      <TickerTape
        items={[
          { symbol: "AAPL", price: "232.00", change: "+0.8%", up: true },
          { symbol: "NVDA", price: "131.00", change: "-1.2%", up: false },
          { symbol: "SPY", price: "591.00", change: "+0.3%", up: true },
        ]}
      />
      <ThemeToggle />
      <Card tag="// CARD-01" title="Project Atlas" corners enter>
        <Badge tone="accent">Active</Badge>{" "}
        <Button variant="primary" onClick={() => setOpen(true)}>Open modal</Button>{" "}
        <Button variant="ghost" onClick={() => toast("// Saved successfully")}>
          Fire a toast
        </Button>
      </Card>
      <Alert tone="warning" tag="FLAG">Your plan is close to its usage limit.</Alert>
      <Button variant="ghost" onClick={() => setPalette(true)}>⌘K commands</Button>
      <DataTable
        pageSize={3}
        columns={[
          { key: "name", label: "Name" },
          { key: "role", label: "Role" },
        ]}
        rows={[
          { name: "Ada Lovelace", role: "Engineer" },
          { name: "Grace Hopper", role: "Design" },
          { name: "Alan Turing", role: "Product" },
          { name: "Katherine Johnson", role: "Analysis" },
        ]}
      />
      <CommandPalette
        open={palette}
        onOpenChange={setPalette}
        items={[
          { label: "Open modal", hint: "run", run: () => setOpen(true) },
          { label: "Fire a toast", hint: "run", run: () => toast("// Saved successfully") },
        ]}
      />
      <Dropdown
        label="Actions"
        items={[
          { label: "Rename", hint: "R", onSelect: () => toast("// Renamed") },
          { label: "", sep: true },
          { label: "Archive", onSelect: () => toast("// Archived") },
        ]}
      />
      <Combobox label="Team" options={["Atlas", "Beacon", "Cartography", "Drift"]} />
      <Reveal delay={120}>
        <Card tag="// MOTION" title="Revealed on scroll">
          Staggered entrance, same rise as the kit.
        </Card>
      </Reveal>
      <p className="mono text-sm">
        Shipped <AnimatedNumber value={128} /> components and counting.
      </p>
      <TiltCard max={8}>
        <Card tag="// TILT" title="Pointer-tracked depth">
          Glare, spotlight, and 3D tilt in one wrapper.
        </Card>
      </TiltCard>
      <DrawOn label="Schematic demo">
        <circle cx="40" cy="36" r="22" />
        <line x1="80" y1="36" x2="208" y2="36" />
      </DrawOn>
      <ScrollRule />
      <Tabs
        label="Demo sections"
        tabs={[
          { id: "one", label: "Overview", content: <p className="text-soft text-sm">First panel.</p> },
          { id: "two", label: "Activity", content: <p className="text-soft text-sm">Second panel.</p> },
        ]}
      />
      <Accordion
        items={[
          { id: "a", title: "Re-theme?", content: "Edit tokens.css — everything follows." },
          { id: "b", title: "Framework-free?", content: "The CSS works anywhere; React owns state here." },
        ]}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        tag="// Revision note"
        footer={<Button variant="secondary" onClick={() => setOpen(false)}>Close</Button>}
      >
        <h3 className="h3">It works</h3>
        <p className="text-soft text-sm">React owns the state; the kit owns the look.</p>
      </Modal>
    </main>
  );
}

export default function Page() {
  return (
    <ToastProvider>
      <Demo />
    </ToastProvider>
  );
}
