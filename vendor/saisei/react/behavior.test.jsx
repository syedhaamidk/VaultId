import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Modal from "./Modal.jsx";
import Tabs from "./Tabs.jsx";
import DataTable from "./DataTable.jsx";
import CommandPalette from "./CommandPalette.jsx";
import Dropdown from "./Dropdown.jsx";
import TiltCard from "./TiltCard.jsx";
import DrawOn from "./DrawOn.jsx";
import ScrollRule from "./ScrollRule.jsx";
import { ToastProvider, useToast } from "./Toast.jsx";

describe("Modal", () => {
  it("traps focus, closes on Escape, restores focus", async () => {
    const user = userEvent.setup();
    function App() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>launch</button>
          <Modal open={open} onClose={() => setOpen(false)} labelledBy="m-t">
            <h3 id="m-t">Title</h3>
            <button>first</button>
            <button>second</button>
          </Modal>
        </>
      );
    }
    // jsdom reports no layout rects, so pretend everything is visible
    // for the trap (which filters on getClientRects, like the vanilla kit).
    const rects = Element.prototype.getClientRects;
    Element.prototype.getClientRects = function () {
      return [{ x: 0, y: 0, width: 10, height: 10, top: 0, left: 0, bottom: 10, right: 10 }];
    };
    try {
      render(<App />);
      await user.click(screen.getByText("launch"));
      expect(screen.getByRole("dialog")).toBeTruthy();
      // Focus starts on the first control inside.
      expect(document.activeElement.textContent).toBe("first");
      // Tab on last wraps to first; Shift+Tab on first wraps to last.
      screen.getByText("second").focus();
      fireEvent.keyDown(document.activeElement, { key: "Tab" });
      expect(document.activeElement.textContent).toBe("first");
      fireEvent.keyDown(document.activeElement, { key: "Tab", shiftKey: true });
      expect(document.activeElement.textContent).toBe("second");
      // Escape closes and restores focus to the trigger.
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(document.activeElement.textContent).toBe("launch");
    } finally {
      Element.prototype.getClientRects = rects;
    }
    // Escape closes and restores focus to the trigger.
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement.textContent).toBe("launch");
  });
});

describe("Tabs", () => {
  const tabs = [
    { id: "a", label: "Alpha", content: "panel-a" },
    { id: "b", label: "Beta", content: "panel-b" },
  ];
  it("arrow keys move selection and focus together", async () => {
    const user = userEvent.setup();
    render(<Tabs tabs={tabs} label="Demo" />);
    const beta = screen.getByRole("tab", { name: "Beta" });
    await user.click(screen.getByRole("tab", { name: "Alpha" }));
    expect(screen.getByText("panel-a")).toBeTruthy();
    screen.getByRole("tab", { name: "Alpha" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(beta.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(beta);
    expect(screen.getByText("panel-b")).toBeTruthy();
  });
});

describe("DataTable", () => {
  const columns = [
    { key: "name", label: "Name" },
    { key: "qty", label: "Qty" },
  ];
  const rows = [
    { name: "Beta", qty: 2 },
    { name: "Alpha", qty: 10 },
    { name: "Gamma", qty: 5 },
  ];
  it("sorts, filters, and pages", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} rows={rows} pageSize={2} />);
    // Sort by name ascending.
    await user.click(screen.getByRole("columnheader", { name: /Name/ }));
    const cells = screen.getAllByRole("cell");
    expect(cells[0].textContent).toBe("Alpha");
    // Filter narrows to one row.
    await user.type(screen.getByLabelText("Filter"), "gamma");
    expect(screen.getAllByRole("cell")[0].textContent).toBe("Gamma");
    expect(screen.getByText(/1 rows/)).toBeTruthy();
  });
});

describe("CommandPalette", () => {
  it("filters and runs on Enter", async () => {
    const user = userEvent.setup();
    let ran = null;
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        items={[
          { label: "Open modal", hint: "run", run: () => { ran = "modal"; } },
          { label: "Fire toast", hint: "run", run: () => { ran = "toast"; } },
        ]}
      />
    );
    await user.type(screen.getByLabelText("Command search"), "toast");
    expect(screen.getByRole("option").textContent).toContain("Fire toast");
    await user.keyboard("{Enter}");
    expect(ran).toBe("toast");
  });
});

describe("Dropdown", () => {
  it("opens, arrows through items, Esc refocuses trigger", async () => {
    const user = userEvent.setup();
    let picked = null;
    render(
      <Dropdown
        label="Acts"
        items={[{ label: "One", onSelect: () => { picked = 1; } }, { label: "Two", onSelect: () => { picked = 2; } }]}
      />
    );
    await user.click(screen.getByRole("button", { name: /Acts/ }));
    const items = screen.getAllByRole("menuitem");
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(items[1]);
    await user.keyboard("{Enter}");
    expect(picked).toBe(2);
  });
});

describe("TiltCard", () => {
  it("tilts toward the pointer and resets on leave", async () => {
    const user = userEvent.setup();
    render(
      <TiltCard max={8}>
        <div className="card">tilting</div>
      </TiltCard>
    );
    const inner = document.querySelector(".tilt-inner");
    await user.hover(screen.getByText("tilting"));
    await waitFor(() => expect(inner.style.getPropertyValue("--rx")).not.toBe(""));
    await user.unhover(screen.getByText("tilting"));
    expect(inner.style.getPropertyValue("--rx")).toBe("0deg");
    expect(inner.style.getPropertyValue("--ry")).toBe("0deg");
  });
});

describe("DrawOn + ScrollRule", () => {
  it("renders schematic svg and fixed rule", () => {
    render(
      <>
        <DrawOn label="Schematic">
          <circle cx="40" cy="36" r="22" />
        </DrawOn>
        <ScrollRule />
      </>
    );
    expect(screen.getByRole("img", { name: "Schematic" })).toBeTruthy();
    expect(document.querySelector(".scroll-rule").getAttribute("aria-hidden")).toBe("true");
  });
});

describe("Toast", () => {
  it("announces through a polite live region, with action", async () => {
    const user = userEvent.setup();
    let acted = false;
    function Fire() {
      const toast = useToast();
      return <button onClick={() => toast("Saved", { label: "Undo", run: () => { acted = true; } })}>fire</button>;
    }
    render(
      <ToastProvider>
        <Fire />
      </ToastProvider>
    );
    await user.click(screen.getByText("fire"));
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(screen.getByText("Saved")).toBeTruthy();
    await user.click(screen.getByText("Undo"));
    expect(acted).toBe(true);
  });
});
