from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Setting(Base):
    """A single application-wide key/value setting."""

    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(Text, primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)


class TaskChildAssignment(Base):
    """Associates a task with a specific child; absence of rows means the task is visible to all children."""

    __tablename__ = "task_child_assignments"

    task_id: Mapped[int] = mapped_column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True)
    child_id: Mapped[int] = mapped_column(Integer, ForeignKey("children.id", ondelete="CASCADE"), primary_key=True)

    task: Mapped["Task"] = relationship("Task", back_populates="assignments")
    child: Mapped["Child"] = relationship("Child", back_populates="assignments")


class Child(Base):
    """A child profile within the household."""

    __tablename__ = "children"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    avatar: Mapped[str] = mapped_column(String, nullable=False, default="🐰")
    color: Mapped[str] = mapped_column(String, nullable=False, default="#F97316")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    completions: Mapped[list["TaskCompletion"]] = relationship(
        "TaskCompletion", back_populates="child", cascade="all, delete-orphan"
    )
    assignments: Mapped[list["TaskChildAssignment"]] = relationship(
        "TaskChildAssignment", back_populates="child", cascade="all, delete-orphan"
    )
    balance: Mapped["ChildBalance | None"] = relationship(
        "ChildBalance", back_populates="child", cascade="all, delete-orphan", uselist=False
    )


class ChildBalance(Base):
    """A child's running carrot balance; one row per child, created lazily on first access."""

    __tablename__ = "child_balances"

    child_id: Mapped[int] = mapped_column(Integer, ForeignKey("children.id", ondelete="CASCADE"), primary_key=True)
    lifetime_earned: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    lifetime_redeemed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    current_balance: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    child: Mapped["Child"] = relationship("Child", back_populates="balance")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    routine: Mapped[str] = mapped_column(String, nullable=False)
    carrot_value: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    estimated_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    completions: Mapped[list["TaskCompletion"]] = relationship(
        "TaskCompletion", back_populates="task", cascade="all, delete-orphan"
    )
    assignments: Mapped[list["TaskChildAssignment"]] = relationship(
        "TaskChildAssignment", back_populates="task", cascade="all, delete-orphan"
    )

    @property
    def assigned_child_ids(self) -> list[int]:
        """Return IDs of children explicitly assigned to this task; empty means all children."""
        return [a.child_id for a in self.assignments]


class TaskCompletion(Base):
    """Records a single task completion for a specific child on a specific date."""

    __tablename__ = "task_completions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(Integer, ForeignKey("tasks.id"), nullable=False)
    child_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("children.id", ondelete="CASCADE"), nullable=True)
    completion_date: Mapped[date] = mapped_column(Date, nullable=False)
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    task: Mapped["Task"] = relationship("Task", back_populates="completions")
    child: Mapped["Child | None"] = relationship("Child", back_populates="completions")

    __table_args__ = (
        UniqueConstraint("task_id", "completion_date", "child_id"),
        Index(
            "uq_task_completions_without_child",
            "task_id",
            "completion_date",
            unique=True,
            sqlite_where=child_id.is_(None),
        ),
    )
