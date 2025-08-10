FROM ubuntu:latest

# Install required tools: gcc, g++, make, git, jq
RUN apt-get update && \
    apt-get install -y gcc g++ make git jq && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /cpp

# Clone test cases repo (same as your Node.js example)
ARG TESTCASES_GIT=https://github.com/noothiakshith/testcases.git
RUN git clone $TESTCASES_GIT

# Copy your C++ test runner and entrypoint
COPY ./run_tests.cpp /cpp/run_tests.cpp
COPY entry-point.sh /entry-point.sh
RUN chmod +x /entry-point.sh

CMD ["/entry-point.sh"]
