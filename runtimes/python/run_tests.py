import os
import json
import requests
import main_func

def read_json(file_path):
    with open(file_path, 'r') as file:
        data = json.load(file)
    return data

def run_test_cases():
    test_cases = read_json('./test_cases.json')
    result = []
    print(test_cases)
    
    try:
        for test_case in test_cases:
            function = getattr(main_func, os.environ.get("MAIN_FUNC"))
            output = function(*test_case['inputs'])
            if output == test_case['expectedOutput']:
                result.append(test_case['id'])
    except Exception as e:
        return {
            "status": "Error",
            "testCasesPassed": result,
            "stdout": str(e),
            "errorMessage": str(e),
            "runtime": 0.1,
            "memoryUsage": 15.0
        }
    
    total_tests = len(test_cases)
    passed_tests = len(result)
    
    if passed_tests == total_tests:
        return {
            "status": "Successful",
            "testCasesPassed": result,
            "stdout": "",
            "runtime": 0.1,
            "memoryUsage": 15.0
        }
    else:
        return {
            "status": "Error",
            "testCasesPassed": result,
            "stdout": "",
            "errorMessage": f"{total_tests - passed_tests} out of {total_tests} test cases failed",
            "runtime": 0.1,
            "memoryUsage": 15.0
        }

def update_submission(result):
    # CALLBACK_URL already includes the full path
    CALLBACK_URL = os.environ.get("CALLBACK_URL")
    print(f"Updating submission at: {CALLBACK_URL}")
    
    headers = {"Content-Type": "application/json"}
    
    try:
        response = requests.patch(CALLBACK_URL, json=result, headers=headers)
        print(f"Response status: {response.status_code}")
        return response
    except Exception as e:
        print(f"Error: {str(e)}")
        return None
    
result = run_test_cases()
print(f"Test results: {result}")
response = update_submission(result=result)
print(response)