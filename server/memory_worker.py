"""Isolated pinned AtMem SDK process. JSON over stdio; no model/cloud tools."""
import json
import sys
import sqlite3
from importlib.metadata import version
from atmem import Memory


def run(payload):
    if version('atmem') != '2.3.10':
        raise RuntimeError('AtMem AI Architect requires the tested AtMem 2.3.10 runtime')
    memory = Memory(payload['database'], auto_vectors=False)
    receipts = sqlite3.connect(payload['database'] + '.receipts.sqlite')
    receipts.execute('CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, result TEXT)')
    results = []
    try:
        for op in payload['operations']:
            subject = op['subject']
            action = op['action']
            if action == 'remember':
                previous = receipts.execute('SELECT result FROM receipts WHERE id=?', (op['eventId'],)).fetchone()
                if previous:
                    results.append(json.loads(previous[0]))
                    continue
                value = memory.remember(subject, message=op['text'], source_type='user_message',
                    interpreted_fact=op['text'], interpreted_fact_key=op['key'], actor='atforma',
                    raw={'interpreter': 'atforma-project-event-v1', 'event_id': op['eventId'], 'source_url': op.get('source', '')})
                receipt = {'refused': value.get('refused', []), 'ids': [r['id'] for r in value.get('records', [])] + value.get('duplicate_ids', [])}
                receipts.execute('INSERT INTO receipts VALUES (?,?)', (op['eventId'], json.dumps(receipt)))
                receipts.commit()
                results.append(receipt)
            elif action == 'recall':
                results.append(memory.recall(subject, op['query'], limit=op.get('limit', 6)))
            elif action == 'list':
                results.append(memory.list(subject, include_inactive=True))
            elif action == 'forget':
                # Forget the entire keyed preference history so old values cannot resurface.
                records = memory.list(subject, include_inactive=True)
                record = next((r for r in records if r['id'] == op['recordId'] and r['status'] != 'tombstoned'), None)
                if record is None:
                    raise ValueError('Memory record is not available in this scope')
                deletion_receipts = []
                for r in records:
                    if r.get('fact_key') == record.get('fact_key') and r['status'] != 'tombstoned':
                        deletion_receipts.append(memory.forget_record(subject, r['id'])['receipt'])
                results.append({'deleted': True, 'receipts': deletion_receipts, 'key': record.get('fact_key')})
            elif action == 'audit':
                report = memory.audit(subject)
                results.append({'valid': report['audit_chain_valid'], 'events': report['audit_log'][-40:]})
            elif action == 'log':
                results.append(memory.log_action(subject, op['eventType'], op['payload'], actor='atforma'))
            else:
                raise ValueError('Unknown memory operation')
        return {'version': version('atmem'), 'results': results}
    finally:
        memory.close()
        receipts.close()


if __name__ == '__main__':
    try:
        print(json.dumps(run(json.load(sys.stdin))))
    except Exception as exc:
        # No text/credentials from an exception cross this process boundary.
        print(json.dumps({'error': type(exc).__name__}))
        sys.exit(1)
