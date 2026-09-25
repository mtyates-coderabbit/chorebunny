import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CarrotCounter } from "@/components/CarrotCounter";

describe("CarrotCounter", () => {
  it("shows the correct earned/total text", () => {
    render(<CarrotCounter earned={3} total={7} />);
    expect(screen.getByText("3 / 7 carrots earned")).toBeInTheDocument();
  });

  it("renders individual carrot icons when total is ≤15", () => {
    render(<CarrotCounter earned={2} total={5} />);
    const carrots = screen.getAllByText("🥕");
    expect(carrots).toHaveLength(5);
  });

  it("renders a progress bar instead of icons when total >15", () => {
    render(<CarrotCounter earned={10} total={20} />);
    // No individual carrot icons — only one in the compact display
    const carrots = screen.getAllByText("🥕");
    expect(carrots).toHaveLength(1);
    expect(screen.getByText("10 / 20 carrots earned")).toBeInTheDocument();
  });

  it("shows 0 earned correctly", () => {
    render(<CarrotCounter earned={0} total={7} />);
    expect(screen.getByText("0 / 7 carrots earned")).toBeInTheDocument();
  });

  it("shows full completion correctly", () => {
    render(<CarrotCounter earned={7} total={7} />);
    expect(screen.getByText("7 / 7 carrots earned")).toBeInTheDocument();
  });

  it("renders exactly 15 icons at the threshold", () => {
    render(<CarrotCounter earned={8} total={15} />);
    const carrots = screen.getAllByText("🥕");
    expect(carrots).toHaveLength(15);
  });
});
