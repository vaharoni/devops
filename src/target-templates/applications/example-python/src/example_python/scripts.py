import subprocess
from devops_python.pyproject import get_pyproject_data
import os
import sys 

package_name = "example_python"
data = get_pyproject_data()
port = data.deployment["port"]
workers = data.deployment.get("workers")

def dev():
    subprocess.run(["fastapi", "dev", f"src/{package_name}/main.py", "--port", str(port)], check=True)

def start():
    cmd = ["fastapi", "run", f"src/{package_name}/main.py", "--port", str(port)]
    if (workers):
        cmd.extend(["--workers", str(workers)])

    subprocess.run(cmd, check=True)
