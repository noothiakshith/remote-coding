#!/bin/bash
set -e # Exit immediately if any command fails

# --- Setup & Debugging ---
echo "=== Starting Execution Pod (v2) ==="
echo "WORKDIR: $(pwd)"
echo "SUBMISSION_ID: ${SUBMISSION_ID}"
echo "CALLBACK_URL: ${CALLBACK_URL}"
echo "PROBLEM_ID: ${PROBLEM_ID}"
echo "TESTCASES_GIT: ${TESTCASES_GIT}"

# --- 1. Clone & Prepare Test Cases ---
echo "=== Cloning Testcases Repository ==="
# Clone into a predictable directory name
git clone "${TESTCASES_GIT}" ./testcases-repo

# The full path to the testcase file we need
TESTCASE_SOURCE_PATH="./testcases-repo/testcases/${PROBLEM_ID}.json"
echo "Looking for test case file at: ${TESTCASE_SOURCE_PATH}"

if [ ! -f "${TESTCASE_SOURCE_PATH}" ]; then
    echo "ERROR: Test case file not found at that path!"
    # Make a best-effort attempt to report the error back to the API
    curl -f -X PATCH -H "Content-Type: application/json" \
         -d '{"status": "Error", "errorMessage": "Test case file not found in repository."}' \
         "${CALLBACK_URL}/submission/${SUBMISSION_ID}" || true
    exit 1
fi
cp "${TESTCASE_SOURCE_PATH}" ./test_cases.json
echo "Test cases copied to ./test_cases.json"

# --- 2. Fetch Submission Source Code ---
echo "=== Fetching Submission Source ==="
FETCH_URL="${CALLBACK_URL}/submission/${SUBMISSION_ID}"
echo "Fetching from: ${FETCH_URL}"

# Save the response body and HTTP status code for debugging
if ! HTTP_STATUS=$(curl -f -s -w "%{http_code}" -o response.json "${FETCH_URL}"); then
    echo "ERROR: curl command failed with status: ${HTTP_STATUS}"
    echo "Check if the API at ${FETCH_URL} is reachable from the cluster."
    # Don't try to report back because the network is likely down
    exit 1
fi

echo "HTTP Status: ${HTTP_STATUS}"

# Check if the response body is valid JSON before trying to parse it
if ! jq . response.json > /dev/null 2>&1; then
    echo "ERROR: Response from API is not valid JSON."
    echo "--- API Response ---"
    cat response.json
    echo "--------------------"
    curl -f -X PATCH -H "Content-Type: application/json" \
         -d '{"status": "Error", "errorMessage": "Invalid response from API when fetching code."}' \
         "${CALLBACK_URL}/submission/${SUBMISSION_ID}" || true
    exit 1
fi

# --- 3. Parse and Save Code ---
echo "=== Processing Source Code ==="
main_func=$(jq -r '.source_code' response.json)
main_func_name=$(jq -r '.mainFuncName' response.json)

if [ "${main_func}" = "null" ] || [ -z "${main_func}" ]; then
    echo "ERROR: 'source_code' field was null or missing in the API response."
    curl -f -X PATCH -H "Content-Type: application/json" \
         -d '{"status": "Error", "errorMessage": "API did not provide source_code."}' \
         "${CALLBACK_URL}/submission/${SUBMISSION_ID}" || true
    exit 1
fi

if [ "${main_func_name}" = "null" ] || [ -z "${main_func_name}" ]; then
    echo "WARNING: 'mainFuncName' field was null or missing, using default 'main'"
    main_func_name="main"
fi

echo "${main_func}" > ./main_func.py
export MAIN_FUNC="${main_func_name}"
echo "Source code saved and MAIN_FUNC exported as: ${MAIN_FUNC}"

# --- 4. Run the Python Test Runner ---
echo "=== Starting Python Test Runner ==="
# Update the CALLBACK_URL for the test runner to use the correct endpoint
export CALLBACK_URL="${CALLBACK_URL}/submission/${SUBMISSION_ID}"
python3 run_tests.py

echo "=== Execution Finished Successfully ==="
exit 0