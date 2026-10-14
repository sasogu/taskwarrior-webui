"""Integration checks against an empty, disposable test container, never production."""
import json
import os
import time
import urllib.error
import urllib.request

base = os.environ.get('TASKWEB_TEST_URL', 'http://127.0.0.1:18097')
identity = 'subtasks@example.invalid'


def request(method, path='/api/tasks', data=None, login=identity):
    headers = {'Content-Type': 'application/json'}
    if login:
        headers['Tailscale-User-Login'] = login
    req = urllib.request.Request(base + path, method=method, headers=headers,
                                 data=json.dumps(data).encode() if data is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=40) as response:
            return response.status, response.read().decode()
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode()


def all_tasks():
    code, body = request('GET')
    assert code == 200, 'The disposable test server is unavailable'
    return json.loads(body)


def saved(uuid):
    return next(task for task in all_tasks() if task['uuid'] == uuid)


def add(description, **fields):
    code, body = request('PUT', data={'tasks': [{'description': description, **fields}]})
    assert code == 200, (code, body)
    return next(task for task in all_tasks() if task['description'] == description)


assert request('GET', login=None)[0] == 403
assert all_tasks() == [], 'ABORT: tests require an empty disposable store'
parent = add('TEST principal', project='prueba')
child = add('TEST subtarea', webparent=parent['uuid'], project='prueba')
grandchild = add('TEST nivel dos', webparent=child['uuid'].upper())
assert saved(child['uuid'])['webparent'] == parent['uuid']
assert saved(grandchild['uuid'])['webparent'] == child['uuid']

code, _ = request('PUT', data={'tasks': [{**parent, 'webparent': grandchild['uuid']}]})
assert code == 400
assert 'webparent' not in saved(parent['uuid'])
assert request('PUT', data={'tasks': [{**child, 'webparent': child['uuid']}]})[0] == 400
assert request('PUT', data={'tasks': [{'description': 'TEST invalid', 'webparent': False}]})[0] == 400
assert request('PUT', data={'tasks': [{'description': 'TEST missing', 'webparent': '00000000-0000-4000-8000-000000000099'}]})[0] == 400
assert request('DELETE', '/api/tasks?tasks=' + parent['uuid'])[0] == 400
assert request('DELETE', '/api/tasks?tasks=' + parent['uuid'].upper())[0] == 400
assert saved(parent['uuid'])['status'] == 'pending'

# Non-hierarchy metadata survives edits; depends remains a separate relation.
child = saved(child['uuid'])
child['depends'] = [parent['uuid']]
child['annotations'] = [{'entry': '20260101T000000Z', 'description': 'TEST annotation'}]
assert request('PUT', data={'tasks': [child]})[0] == 200
child = saved(child['uuid'])
child['description'] = 'TEST subtarea editada'
child['uuid'] = child['uuid'].upper()
assert request('PUT', data={'tasks': [child]})[0] == 200
child = saved(child['uuid'].lower())
assert child['depends'] == [parent['uuid']]
assert len(child['annotations']) == 1
assert child['webparent'] == parent['uuid']

# An external-style update invalidates an old copy instead of dropping its annotations.
stale = dict(child)
time.sleep(1.1)
child['priority'] = 'H'
assert request('PUT', data={'tasks': [child]})[0] == 200
assert request('PUT', data={'tasks': [stale]})[0] == 409

grandchild = saved(grandchild['uuid'])
assert request('PUT', data={'tasks': [{**grandchild, 'status': 'completed'}]})[0] == 200
assert saved(grandchild['uuid'])['webparent'] == child['uuid']
assert saved(child['uuid'])['status'] == 'pending'
grandchild = saved(grandchild['uuid'])
grandchild['webparent'] = ''
assert request('PUT', data={'tasks': [grandchild]})[0] == 200
assert 'webparent' not in saved(grandchild['uuid'])

# Delete the whole selected branch in one request; nothing is implicitly cascaded.
ids = [task['uuid'] for task in all_tasks()]
assert request('DELETE', '/api/tasks?' + '&'.join('tasks=' + uuid for uuid in ids))[0] == 200
assert all(task['status'] == 'deleted' for task in all_tasks())
print('API integration: nesting, cycles, missing/self parent, metadata, conflicts, completion, detach and deletion PASS')
