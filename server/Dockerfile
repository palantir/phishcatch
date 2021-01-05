FROM hub.docker.palantir.build/tiangolo/uvicorn-gunicorn-fastapi:python3.7

# RUN apt-get update
# RUN apt-get -y upgrade

COPY ./app /app/app

RUN pip3 install -r /app/app/requirements.txt

