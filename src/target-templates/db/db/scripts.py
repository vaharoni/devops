import subprocess

def generate():
    subprocess.run(["prisma", "generate", "--generator", "python-client"], check=True)
