import subprocess
from devops_python.pyproject import get_pyproject_data
import os
import sys 

data = get_pyproject_data()
port = data.deployment["port"]
workers = data.deployment.get("workers")

def dev():
    subprocess.run(["fastapi", "dev", "src/example_python/main.py", "--port", str(port)], check=True)

def start():
    cmd = ["fastapi", "run", "src/python_mock/main.py", "--port", str(port)]
    if (workers):
        cmd.extend(["--workers", str(workers)])

    subprocess.run(cmd, check=True)
