import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { TaskCard } from "@/components/TaskCard";
import type { Task } from "@/lib/types";

const task: Task = {
  id: 1,
  name: "Brush teeth",
  description: "Two minutes!",
  routine: "morning",
  carrot_value: 1,
  is_active: true,
  sort_order: 0,
  created_at: "2026-09-25T00:00:00",
};

describe("TaskCard", () => {
  it("renders task name and description", () => {
    render(<TaskCard task={task} isCompleted={false} onToggle={vi.fn()} />);
    expect(screen.getByText("Brush teeth")).toBeInTheDocument();
    expect(screen.getByText("Two minutes!")).toBeInTheDocument();
  });

  it("shows carrot icons equal to carrot_value", () => {
    const bigTask = { ...task, carrot_value: 3 };
    render(<TaskCard task={bigTask} isCompleted={false} onToggle={vi.fn()} />);
    const carrots = screen.getAllByText("🥕");
    expect(carrots).toHaveLength(3);
  });

  it("calls onToggle when clicked", async () => {
    const onToggle = vi.fn();
    render(<TaskCard task={task} isCompleted={false} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("shows strikethrough on task name when completed", () => {
    render(<TaskCard task={task} isCompleted={true} onToggle={vi.fn()} />);
    const name = screen.getByText("Brush teeth");
    expect(name).toHaveClass("line-through");
  });

  it("does not strikethrough task name when not completed", () => {
    render(<TaskCard task={task} isCompleted={false} onToggle={vi.fn()} />);
    const name = screen.getByText("Brush teeth");
    expect(name).not.toHaveClass("line-through");
  });

  it("is disabled when isPending is true", () => {
    render(<TaskCard task={task} isCompleted={false} onToggle={vi.fn()} isPending={true} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("is not disabled when isPending is false", () => {
    render(<TaskCard task={task} isCompleted={false} onToggle={vi.fn()} isPending={false} />);
    expect(screen.getByRole("button")).not.toBeDisabled();
  });
});
