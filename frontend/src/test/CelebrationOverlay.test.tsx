import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";

// canvas-confetti is not available in jsdom — stub it out
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

describe("CelebrationOverlay", () => {
  it("renders the earned carrot count", () => {
    render(<CelebrationOverlay earned={7} total={7} onDismiss={vi.fn()} />);
    // Text is split across <span> elements, check the containing paragraph's textContent
    const p = screen.getByText(/You earned/i);
    expect(p.textContent).toMatch(/7 out of 7 carrots/);
  });

  it("shows the congratulatory heading", () => {
    render(<CelebrationOverlay earned={5} total={5} onDismiss={vi.fn()} />);
    expect(screen.getByText("Amazing job!")).toBeInTheDocument();
  });

  it("calls onDismiss when the button is clicked", async () => {
    const onDismiss = vi.fn();
    render(<CelebrationOverlay earned={7} total={7} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole("button", { name: /woohoo/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("calls onDismiss when the backdrop is clicked", async () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <CelebrationOverlay earned={7} total={7} onDismiss={onDismiss} />
    );
    // Click the outermost overlay div (the backdrop)
    await userEvent.click(container.firstChild as Element);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("displays different earned vs total values correctly", () => {
    render(<CelebrationOverlay earned={5} total={8} onDismiss={vi.fn()} />);
    const p = screen.getByText(/You earned/i);
    expect(p.textContent).toMatch(/5 out of 8 carrots/);
  });
});
