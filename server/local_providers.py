"""Supported local CLI account adapters. No account token extraction or custom OAuth."""
import asyncio, json, os, shutil, signal, sys, tempfile
from pathlib import Path

SIGN_IN={'claude-code':('claude','claude auth login'),'codex':('codex','codex login'),'gemini-cli':('gemini','gemini'),'copilot':('copilot','copilot login')}

def account_environment():
    env=dict(os.environ)
    for key in ['ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','OPENAI_API_KEY','CODEX_API_KEY','GEMINI_API_KEY','GOOGLE_API_KEY','GITHUB_TOKEN','GH_TOKEN','COPILOT_GITHUB_TOKEN']:
        env.pop(key,None)
    return env

# Official sign-in, started from the app: each CLI opens its provider's own page in the browser.
LOGIN={'claude-code':['claude','auth','login'],'codex':['codex','login'],'copilot':['copilot','login']}
STATUS={'claude-code':['claude','auth','status','--json'],'codex':['codex','login','status']}
LOGINS={}

def signed_in(provider):
    """True/False when the CLI can tell us, None when it can't."""
    argv=STATUS.get(provider)
    if not argv or not shutil.which(argv[0]):return None
    import subprocess
    try:
        done=subprocess.run(argv,capture_output=True,text=True,timeout=8,stdin=subprocess.DEVNULL,env=account_environment())
    except Exception:
        return None
    if provider=='claude-code':
        try:return bool(json.loads(done.stdout).get('loggedIn'))
        except Exception:return None
    return done.returncode==0 and 'logged in' in (done.stdout+done.stderr).lower()

def capabilities():
    return {key:{'available':bool(shutil.which(binary)),'installed':bool(shutil.which(binary)),'loginCommand':command,'canSignInFromApp':key in LOGIN,
                 'signedIn':signed_in(key) if shutil.which(binary) else False} for key,(binary,command) in SIGN_IN.items()}

async def start_login(provider):
    """Start the provider's official login; return a sign-in URL if the CLI prints one."""
    import re
    argv=LOGIN.get(provider)
    if not argv or not shutil.which(argv[0]):raise RuntimeError('This provider has no sign-in AtMem AI Architect can start. Use its API key instead.')
    running=LOGINS.get(provider)
    if running and running.returncode is None:return {'started':True,'url':None}
    process=await asyncio.create_subprocess_exec(*argv,stdin=asyncio.subprocess.DEVNULL,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.STDOUT,env=account_environment(),start_new_session=os.name!='nt')
    LOGINS[provider]=process
    url=None
    try:
        deadline=asyncio.get_running_loop().time()+6
        while asyncio.get_running_loop().time()<deadline and url is None:
            line=await asyncio.wait_for(process.stdout.readline(),timeout=max(.1,deadline-asyncio.get_running_loop().time()))
            if not line:break
            found=re.search(r'https://\S+',line.decode(errors='ignore'))
            if found:url=found.group(0).rstrip('.,)')
    except asyncio.TimeoutError:pass
    # Keep draining output so the CLI can finish its callback; don't block the request.
    async def drain():
        try:
            while await process.stdout.read(4096):pass
        except Exception:pass
    asyncio.create_task(drain())
    return {'started':True,'url':url}

def extract_json(text):
    text=text.strip()
    if text.startswith('```'):text='\n'.join(text.splitlines()[1:-1])
    return json.loads(text)

def strict_schema(schema):
    """Codex structured output requires every declared object field to be required."""
    schema=json.loads(json.dumps(schema))
    def visit(value):
        if isinstance(value,dict):
            if value.get('type')=='object' and 'properties' in value:value['required']=list(value['properties']);value['additionalProperties']=False
            for child in value.values():visit(child)
        elif isinstance(value,list):
            for child in value:visit(child)
    visit(schema);return schema

async def communicate(argv,prompt,cwd,is_disconnected,env=None,timeout=150):
    process=await asyncio.create_subprocess_exec(*argv,stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE,cwd=cwd,env=env,start_new_session=os.name!='nt')
    task=asyncio.create_task(process.communicate(prompt.encode()))
    deadline=asyncio.get_running_loop().time()+timeout
    try:
        while not task.done():
            if await is_disconnected():raise asyncio.CancelledError()
            if asyncio.get_running_loop().time()>deadline:raise TimeoutError('Architect request timed out.')
            await asyncio.sleep(.2)
        output,error=await task
        if process.returncode:raise RuntimeError('Provider request failed. Check its official CLI sign-in, model access and usage limits. No changes were applied.')
        return output.decode()
    finally:
        if process.returncode is None:
            try:
                if os.name=='nt':process.terminate()
                else:os.killpg(process.pid,signal.SIGTERM)
            except ProcessLookupError:pass
            try:await asyncio.wait_for(process.wait(),3)
            except asyncio.TimeoutError:
                try:
                    if os.name=='nt':process.kill()
                    else:os.killpg(process.pid,signal.SIGKILL)
                except ProcessLookupError:pass
                await process.wait()
        if not task.done():task.cancel()
        try:await task
        except (asyncio.CancelledError,Exception):pass

CLAUDE_EFFORTS=['low','medium','high','xhigh','max']
# Claude Code accepts these model names; the list matches the current Claude family.
CLAUDE_MODELS=[('claude-opus-5-5','Opus 5.5'),('claude-fable-5-1','Fable 5.1'),('claude-sonnet-5','Sonnet 5'),('claude-haiku-4-5-20251001','Haiku 4.5')]
COPILOT_EFFORTS=['low','medium','high','xhigh','max']

def models(provider):
    """Models and thinking levels the provider's own CLI reports; empty list means type an ID."""
    import subprocess
    if provider=='claude-code':
        return [{'id':i,'name':n,'efforts':CLAUDE_EFFORTS,'defaultEffort':'medium'} for i,n in CLAUDE_MODELS]
    if provider=='codex' and shutil.which('codex'):
        try:
            done=subprocess.run(['codex','debug','models'],capture_output=True,text=True,timeout=15,stdin=subprocess.DEVNULL,env=account_environment())
            data=json.loads(done.stdout)
            return [{'id':m['slug'],'name':m.get('display_name',m['slug']),'efforts':[e['effort'] for e in m.get('supported_reasoning_levels',[])],'defaultEffort':m.get('default_reasoning_level')}
                    for m in data.get('models',[]) if m.get('visibility','list')=='list']
        except Exception:
            return []
    if provider=='gemini-cli' and shutil.which('gemini'):
        return [{'id':'auto','name':'Gemini CLI (your configured model)','efforts':[],'defaultEffort':None}]
    if provider=='copilot':
        # The Copilot SDK path doesn't take a thinking level yet; offer only what we can honour.
        return [{'id':'auto','name':'Auto (Copilot picks)','efforts':[],'defaultEffort':None}]
    return []

async def call_cli(provider,model,prompt,system,schema,is_disconnected,effort=None):
    binary=shutil.which(SIGN_IN[provider][0])
    if not binary:raise RuntimeError(f'Install and sign in with {SIGN_IN[provider][0]} first, or choose an API key.')
    with tempfile.TemporaryDirectory(prefix='atforma-agent-') as cwd:
        env=account_environment()
        if provider=='claude-code':
            args=[binary,'-p','--safe-mode','--strict-mcp-config','--tools','','--no-session-persistence','--output-format','json','--json-schema',json.dumps(schema),'--system-prompt',system]
            if model not in ('default','auto'):args+=['--model',model]
            if effort in CLAUDE_EFFORTS:args+=['--effort',effort]
            result=json.loads(await communicate(args,prompt,cwd,is_disconnected,env))
            if result.get('is_error'):raise RuntimeError('Claude request failed. Check sign-in, model access and usage limits.')
            return result.get('structured_output') or extract_json(result.get('result',''))
        if provider=='codex':
            schema_path=Path(cwd)/'response-schema.json';schema_path.write_text(json.dumps(strict_schema(schema)))
            args=[binary,'exec','--sandbox','read-only','--skip-git-repo-check','--ephemeral','--ignore-user-config','--ignore-rules','--disable','shell_tool','--disable','unified_exec','--disable','plugins','--disable','apps','--disable','browser_use','--disable','in_app_browser','--disable','code_mode_host','-c','approval_policy="never"','-c','web_search="disabled"','--output-schema',str(schema_path),'--color','never','-']
            if model not in ('default','auto'):args+=['--model',model]
            if effort:args+=['-c',f'model_reasoning_effort="{effort}"']
            return extract_json(await communicate(args,system+'\n\n'+prompt,cwd,is_disconnected,env))
        if provider=='gemini-cli':
            settings=Path(cwd)/'settings.json';settings.write_text(json.dumps({'tools':{'core':[]},'hooksConfig':{'enabled':False},'mcp':{'allowed':['atforma-no-servers']},'telemetry':{'enabled':False},'general':{'enableAutoUpdate':False,'sessionRetention':{'enabled':False}}}))
            env['GEMINI_CLI_SYSTEM_SETTINGS_PATH']=str(settings)
            policy=Path(cwd)/'deny-tools.toml';policy.write_text('[[rule]]\ntoolName = "*"\ndecision = "deny"\npriority = 999\n')
            args=[binary,'--prompt',system,'--output-format','json','--approval-mode','plan','--extensions','none','--allowed-mcp-server-names','atforma-no-servers','--policy',str(policy)]
            if model not in ('default','auto'):args+=['--model',model]
            result=json.loads(await communicate(args,prompt,cwd,is_disconnected,env))
            if result.get('error'):raise RuntimeError('Gemini request failed. Run gemini to sign in and check your model access.')
            return extract_json(result.get('response',''))
        # Official Copilot SDK provides tool exclusion and permission denial without --allow-all.
        worker=Path(__file__).with_name('copilot_worker.py')
        return extract_json(await communicate([sys.executable,str(worker)],json.dumps({'prompt':prompt,'system':system,'schema':strict_schema(schema),'model':model,'cwd':cwd,'cli':binary}),cwd,is_disconnected,env))
