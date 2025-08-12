FROM python:latest

# Install dependencies
RUN apt-get update && apt-get install -y jq git && apt-get clean

# Install Python dependencies
RUN pip install requests

# Set working directory
WORKDIR /python

# Clone testcases repository
ARG TESTCASES_GIT=https://github.com/noothiakshith/testcases.git
RUN git clone $TESTCASES_GIT

# Copy scripts
COPY ./run_tests.py /python/run_tests.py
COPY ./entry-point.sh /python/entry-point.sh

# Ensure entry-point.sh is executable
RUN chmod +x /python/entry-point.sh

# Set entrypoint
CMD ["/python/entry-point.sh"]