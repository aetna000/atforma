"""Install the tested AtMem runtime separately from model SDK dependencies."""
from pathlib import Path
import os
import subprocess
import sys
import venv
root=Path(__file__).resolve().parent.parent
folder=root/'.memory-venv'
venv.EnvBuilder(with_pip=True).create(folder)
python=folder/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
subprocess.run([str(python),'-m','pip','install','-r',str(root/'server/memory-requirements.txt')],check=True)
print('AtMem runtime installed. AtMem AI Architect uses its own scoped store; existing installations retain their data directory.')
