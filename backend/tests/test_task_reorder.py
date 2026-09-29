import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app import crud, schemas


def test_description_null_clears_but_omission_preserves(client):
    task = client.post('/api/tasks', json={
        'name': 'Brush teeth', 'routine': 'morning', 'description': 'Use toothpaste',
    }).json()
    url = f"/api/tasks/{task['id']}"
    assert client.put(url, json={'name': 'Brush carefully'}).json()['description'] == 'Use toothpaste'
    assert client.put(url, json={'description': None}).json()['description'] is None
    assert client.get('/api/tasks').json()[0]['description'] is None


@pytest.mark.parametrize('direction', [-1, 1])
def test_reorder_tied_positions_includes_hidden_and_preserves_other_routine(client, direction):
    tasks = [client.post('/api/tasks', json={
        'name': str(i), 'routine': 'morning',
    }).json() for i in range(3)]
    evening = client.post('/api/tasks', json={
        'name': 'Read', 'routine': 'evening', 'sort_order': 7,
    }).json()
    client.put(f"/api/tasks/{tasks[0]['id']}", json={'is_active': False})
    response = client.post(f"/api/tasks/{tasks[1]['id']}/reorder", json={'direction': direction})
    assert response.status_code == 204
    ordered = client.get('/api/tasks?routine=morning&active_only=false').json()
    expected = [tasks[1], tasks[0], tasks[2]] if direction == -1 else [tasks[0], tasks[2], tasks[1]]
    assert [t['id'] for t in ordered] == [t['id'] for t in expected]
    assert [t['sort_order'] for t in ordered] == [0, 1, 2]
    assert client.get('/api/tasks?routine=evening').json() == [evening]


@pytest.mark.parametrize('direction', [-1, 1])
def test_reorder_boundary_is_noop(client, morning_task, direction):
    before = client.get('/api/tasks').json()
    assert client.post(f'/api/tasks/{morning_task.id}/reorder', json={'direction': direction}).status_code == 204
    assert client.get('/api/tasks').json() == before


def test_reorder_missing_task(client):
    assert client.post('/api/tasks/999/reorder', json={'direction': 1}).status_code == 404


@pytest.mark.parametrize('payload', [{}, {'direction': 0}, {'direction': 2}, {'direction': None}])
def test_reorder_invalid_direction(client, morning_task, payload):
    before = client.get('/api/tasks').json()
    assert client.post(f'/api/tasks/{morning_task.id}/reorder', json=payload).status_code == 422
    assert client.get('/api/tasks').json() == before


def test_reorder_rolls_back_all_positions_on_database_failure(db):
    first = crud.create_task(db, schemas.TaskCreate(name='First', routine='morning', sort_order=10))
    second = crud.create_task(db, schemas.TaskCreate(name='Second', routine='morning', sort_order=20))
    db.execute(text(f"""
        CREATE TRIGGER reject_second_reorder BEFORE UPDATE OF sort_order ON tasks
        WHEN OLD.id = {second.id}
        BEGIN SELECT RAISE(ABORT, 'reorder failed'); END
    """))
    db.commit()
    with pytest.raises(IntegrityError):
        crud.reorder_task(db, first.id, schemas.TaskReorder(direction=1))
    assert [(t.name, t.sort_order) for t in crud.get_tasks(db)] == [('First', 10), ('Second', 20)]
