"""Local schema validation of server-generated Terraform. Never plan/apply or read cloud credentials."""
import asyncio
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict
from typing import Literal

router = APIRouter()
LOCK = asyncio.Lock()
ROOT = Path(__file__).resolve().parent.parent

class ValidationRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    project: dict
    environment: Literal['staging', 'production'] = 'staging'

def validate(payload):
    binary = os.getenv('ATFORMA_TERRAFORM_BIN') or shutil.which('terraform', path=str(ROOT/'.venv'/'bin')+os.pathsep+os.getenv('PATH', ''))
    if not binary:
        return {'status': 'unavailable', 'checks': [], 'message': 'Terraform is not installed. Install Terraform or set ATFORMA_TERRAFORM_BIN for the local service. No CLI validation was run.'}
    node = shutil.which('node')
    if not node:
        return {'status': 'unavailable', 'checks': [], 'message': 'Node is unavailable to the local service.'}
    with tempfile.TemporaryDirectory(prefix='atforma-validate-') as folder:
        env = {'PATH': os.getenv('PATH', ''), 'HOME': folder, 'TMPDIR': folder, 'TF_IN_AUTOMATION': '1', 'CHECKPOINT_DISABLE': '1'}
        generated = subprocess.run([node, str(ROOT/'scripts/terraform-render.mjs')], input=json.dumps(payload.model_dump()), capture_output=True, text=True, timeout=20, env=env, cwd=ROOT)
        if generated.returncode:
            raise ValueError('The project could not be converted to the trusted Terraform draft.')
        files = json.loads(generated.stdout)
        Path(folder, 'main.tf.json').write_text(files['main.tf.json'])
        checks = []
        for name, args in [('Provider initialization', ['init', '-backend=false', '-input=false', '-no-color']), ('Terraform schema validation', ['validate', '-json'])]:
            result = subprocess.run([binary, f'-chdir={folder}', *args], env=env, capture_output=True, text=True, timeout=120)
            checks.append({'name': name, 'passed': result.returncode == 0, 'output': (result.stdout+'\n'+result.stderr)[-16000:]})
            if result.returncode:
                return {'status': 'failed', 'checks': checks, 'message': 'Terraform checks failed. Review the diagnostics.'}
        return {'status': 'passed', 'checks': checks, 'message': 'Terraform configuration and provider schema passed validation. No cloud plan or deployment was run.'}

@router.post('/api/terraform/validate')
async def validate_route(payload: ValidationRequest):
    if LOCK.locked():
        raise HTTPException(409, 'A Terraform validation is already running.')
    async with LOCK:
        try:
            return await asyncio.to_thread(validate, payload)
        except subprocess.TimeoutExpired:
            raise HTTPException(504, 'Terraform validation timed out. No deployment was attempted.')
        except (ValueError, OSError):
            raise HTTPException(422, 'Could not validate the generated Terraform draft. Check the project and local Terraform installation.')
