FROM python:3.11-slim

# Install git and jq
RUN apt-get update && \
    apt-get install -y git jq && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /python

# Clone test cases repo (same as your Node.js example)
ARG TESTCASES_GIT=https://github.com/noothiakshith/testcases.git
RUN git clone $TESTCASES_GIT

# Copy your Python test runner and entrypoint
COPY ./run_tests.py /python/run_tests.py
COPY entry-point.sh /entry-point.sh
RUN chmod +x /entry-point.sh

CMD ["/entry-point.sh"]
