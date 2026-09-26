from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class TaskCreate(BaseModel):
    name: str
    description: str | None = None
    routine: Literal["morning", "evening"]
    carrot_value: int = Field(default=1, ge=1, le=5)
    estimated_minutes: int | None = Field(default=None, ge=1, le=180)
    sort_order: int = 0


class TaskUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    routine: Literal["morning", "evening"] | None = None
    carrot_value: int | None = Field(default=None, ge=1, le=5)
    estimated_minutes: int | None = Field(default=None, ge=1, le=180)
    is_active: bool | None = None
    sort_order: int | None = None


class Task(BaseModel):
    id: int
    name: str
    description: str | None
    routine: str
    carrot_value: int
    estimated_minutes: int | None
    is_active: bool
    sort_order: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CompletionToggleRequest(BaseModel):
    task_id: int
    completion_date: date = Field(default_factory=date.today)


class Completion(BaseModel):
    id: int
    task_id: int
    completion_date: date
    completed_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ToggleResult(BaseModel):
    action: Literal["created", "deleted"]
    completion: Completion | None


class RoutineSummary(BaseModel):
    total_carrots: int
    earned_carrots: int
    total_count: int
    completed_count: int


class DailySummary(BaseModel):
    date: date
    morning: RoutineSummary
    evening: RoutineSummary
    total_carrots: int
    earned_carrots: int


class DayCarrots(BaseModel):
    date: date
    earned_carrots: int
    total_carrots: int
    morning_earned_carrots: int
    evening_earned_carrots: int


class TaskStat(BaseModel):
    task_id: int
    name: str
    routine: str
    count: int


class RangeSummary(BaseModel):
    start_date: date
    end_date: date
    days: list[DayCarrots]
    task_stats: list[TaskStat]
